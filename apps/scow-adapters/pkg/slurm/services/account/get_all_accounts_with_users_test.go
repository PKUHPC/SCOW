package account

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/slurm/client"
	"scow-adapters/pkg/slurm/config"
	"scow-adapters/pkg/slurm/utils"
)

const accountQueryTestDriverName = "account-query-test"

var accountQueryTestWholeBlockRows [][]driver.Value
var accountQueryTestPartitionBlocked bool

func init() {
	sql.Register(accountQueryTestDriverName, accountQueryTestDriver{})
}

type accountQueryTestDriver struct{}

func (accountQueryTestDriver) Open(string) (driver.Conn, error) {
	return accountQueryTestConn{}, nil
}

type accountQueryTestConn struct{}

func (accountQueryTestConn) Prepare(string) (driver.Stmt, error) { return nil, driver.ErrSkip }
func (accountQueryTestConn) Close() error                        { return nil }
func (accountQueryTestConn) Begin() (driver.Tx, error)           { return nil, driver.ErrSkip }

func (accountQueryTestConn) QueryContext(_ context.Context, query string, _ []driver.NamedValue) (driver.Rows, error) {
	switch {
	case strings.Contains(query, "FROM acct_table"):
		return &accountQueryTestRows{
			columns: []string{"name"},
			values:  [][]driver.Value{{"root"}, {"account_without_partitions"}, {"account_with_mixed_users"}},
		}, nil
	case strings.Contains(query, "GROUP BY a.acct, a.user"):
		return &accountQueryTestRows{
			columns: []string{"acct", "user", "blocked"},
			values: [][]driver.Value{
				{"root", "root_user", int64(0)},
				{"account_without_partitions", "test_user", int64(0)},
				// 双零 association 即使没有恢复记录，也应识别为封锁。
				{"account_with_mixed_users", "user_without_partition", int64(1)},
				{"account_with_mixed_users", "user_with_partition", int64(1)},
			},
		}, nil
	case strings.Contains(query, "HAVING MIN(IF("):
		values := [][]driver.Value{{"normal"}}
		if accountQueryTestPartitionBlocked {
			values = nil
		}
		return &accountQueryTestRows{
			columns: []string{"partition"},
			values:  values,
		}, nil
	case strings.Contains(query, "GROUP BY acct, `partition`"):
		blocked := int64(0)
		if accountQueryTestPartitionBlocked {
			blocked = 1
		}
		return &accountQueryTestRows{
			columns: []string{"acct", "partition", "blocked"},
			values: [][]driver.Value{
				{"account_without_partitions", "", int64(0)},
				{"account_with_mixed_users", "", int64(0)},
				{"account_with_mixed_users", "normal", blocked},
			},
		}, nil
	case strings.Contains(query, "AND `user` = '' AND `partition` = ''"):
		return &accountQueryTestRows{
			columns: []string{"account_name"},
			values:  accountQueryTestWholeBlockRows,
		}, nil
	case strings.Contains(query, "SELECT DISTINCT acct, `partition`"):
		return &accountQueryTestRows{
			columns: []string{"acct", "partition"},
			values: [][]driver.Value{
				{"account_without_partitions", ""},
				{"account_with_mixed_users", ""},
				{"account_with_mixed_users", "normal"},
			},
		}, nil
	default:
		return nil, driver.ErrSkip
	}
}

type accountQueryTestRows struct {
	columns []string
	values  [][]driver.Value
	index   int
}

func (r *accountQueryTestRows) Columns() []string { return r.columns }
func (r *accountQueryTestRows) Close() error      { return nil }
func (r *accountQueryTestRows) Next(dest []driver.Value) error {
	if r.index >= len(r.values) {
		return io.EOF
	}
	copy(dest, r.values[r.index])
	r.index++
	return nil
}

func useAccountQueryTestDB(t *testing.T) {
	t.Helper()

	db, err := sql.Open(accountQueryTestDriverName, "")
	require.NoError(t, err)

	originalDB := client.SlurmDB
	originalConfig := config.SlurmValue
	client.SlurmDB = db
	config.SlurmValue = &config.SlurmConfig{MySQLConfig: config.MySQLConfig{ClusterName: "test_cluster"}}

	t.Cleanup(func() {
		accountQueryTestWholeBlockRows = nil
		accountQueryTestPartitionBlocked = false
		client.SlurmDB = originalDB
		config.SlurmValue = originalConfig
		require.NoError(t, db.Close())
	})
}

func TestGetAllAccountsWithUsersReturnsWholeAccountBlock(t *testing.T) {
	useAccountQueryTestDB(t)
	accountQueryTestWholeBlockRows = [][]driver.Value{{"account_with_mixed_users"}}

	response, err := (&ServerAccount{}).GetAllAccountsWithUsers(context.Background(), &pb.GetAllAccountsWithUsersRequest{})

	require.NoError(t, err)
	accounts := make(map[string]*pb.ClusterAccountInfo, len(response.Accounts))
	for _, account := range response.Accounts {
		accounts[account.AccountName] = account
	}
	require.True(t, accounts["account_with_mixed_users"].Blocked)
	require.False(t, accounts["account_without_partitions"].Blocked)
}

func TestAuthorizedPartitionsRemainVisibleWhenWholeAccountIsBlocked(t *testing.T) {
	useAccountQueryTestDB(t)
	accountQueryTestWholeBlockRows = [][]driver.Value{{"account_with_mixed_users"}}

	// GetAvailablePartitions 使用单账户授权查询；整体欠费记录不能隐藏 normal 分区。
	partitions, err := utils.GetAccountAuthorizedPartitionsInDatabase("account_with_mixed_users")
	require.NoError(t, err)
	require.Equal(t, []string{"normal"}, partitions)

	// GetSummaryClusterInfo 使用批量授权查询；同一欠费账户也应保留授权分区。
	partitionInfo, err := utils.GetAccountAuthorizedPartitionByAssociation()
	require.NoError(t, err)
	require.Equal(t, []string{"normal"}, partitionInfo["account_with_mixed_users"].AllowedPartitions)
}

func TestUnauthorizedPartitionsRemainHidden(t *testing.T) {
	useAccountQueryTestDB(t)
	accountQueryTestPartitionBlocked = true

	// 叶子 association 的 Grp* 全部为双零，因此两个资源展示查询都必须隐藏 normal 分区。
	partitions, err := utils.GetAccountAuthorizedPartitionsInDatabase("account_with_mixed_users")
	require.NoError(t, err)
	require.Empty(t, partitions)

	partitionInfo, err := utils.GetAccountAuthorizedPartitionByAssociation()
	require.NoError(t, err)
	require.Empty(t, partitionInfo["account_with_mixed_users"].AllowedPartitions)
}

func TestGetAllAccountsWithUsersReturnsAccountWithoutPartitionAssociations(t *testing.T) {
	useAccountQueryTestDB(t)

	response, err := (&ServerAccount{}).GetAllAccountsWithUsers(context.Background(), &pb.GetAllAccountsWithUsersRequest{})

	require.NoError(t, err)
	require.Len(t, response.Accounts, 2)
	for _, account := range response.Accounts {
		require.NotEqual(t, "root", account.AccountName)
	}
	accounts := make(map[string]*pb.ClusterAccountInfo, len(response.Accounts))
	for _, account := range response.Accounts {
		accounts[account.AccountName] = account
	}
	withoutPartitions := accounts["account_without_partitions"]
	require.False(t, withoutPartitions.Blocked)
	require.Len(t, withoutPartitions.Users, 1)
	require.False(t, withoutPartitions.Users[0].Blocked)

	mixed := accounts["account_with_mixed_users"]
	require.False(t, mixed.Blocked)
	users := make(map[string]*pb.ClusterAccountInfo_UserInAccount, len(mixed.Users))
	for _, user := range mixed.Users {
		users[user.UserId] = user
	}
	require.True(t, users["user_without_partition"].Blocked)
	require.True(t, users["user_with_partition"].Blocked)
}

func TestGetAllAccountsWithUsersAndBlockedDetailsReturnsAccountWithoutPartitionAssociations(t *testing.T) {
	useAccountQueryTestDB(t)

	response, err := (&ServerAccount{}).GetAllAccountsWithUsersAndBlockedDetails(
		context.Background(),
		&pb.GetAllAccountsWithUsersAndBlockedDetailsRequest{},
	)

	require.NoError(t, err)
	require.Len(t, response.Accounts, 2)
	for _, account := range response.Accounts {
		require.NotEqual(t, "root", account.AccountName)
	}
	accounts := make(map[string]*pb.ClusterAccountInfoWithBlockedDetails, len(response.Accounts))
	for _, account := range response.Accounts {
		accounts[account.AccountName] = account
	}
	withoutPartitions := accounts["account_without_partitions"]
	require.False(t, withoutPartitions.Blocked)
	require.Len(t, withoutPartitions.Users, 1)
	require.False(t, withoutPartitions.Users[0].Blocked)
	require.Empty(t, withoutPartitions.AccountBlockedDetails)

	mixed := accounts["account_with_mixed_users"]
	require.False(t, mixed.Blocked)
	require.Len(t, mixed.AccountBlockedDetails, 1)
}
