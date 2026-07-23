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
)

const accountQueryTestDriverName = "account-query-test"

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
	case strings.Contains(query, "user != ''") && strings.Contains(query, "max_jobs"):
		return &accountQueryTestRows{
			columns: []string{"acct", "user", "max_jobs"},
			values: [][]driver.Value{
				{"root", "root_user", nil},
				{"account_without_partitions", "test_user", nil},
				{"account_with_mixed_users", "user_without_partition", int64(0)},
				{"account_with_mixed_users", "user_with_partition", nil},
				{"account_with_mixed_users", "user_with_partition", int64(0)},
			},
		}, nil
	case strings.Contains(query, "SELECT acct, `partition`, max_submit_jobs"):
		return &accountQueryTestRows{
			columns: []string{"acct", "partition", "max_submit_jobs"},
			values: [][]driver.Value{
				{"root", "", nil},
				{"account_without_partitions", "", nil},
				// 混合账户已有具体分区，该基础值不能覆盖具体分区计算结果。
				{"account_with_mixed_users", "", int64(0)},
				{"account_with_mixed_users", "normal", nil},
			},
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
		client.SlurmDB = originalDB
		config.SlurmValue = originalConfig
		require.NoError(t, db.Close())
	})
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
