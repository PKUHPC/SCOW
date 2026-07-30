package main

import (
	"context"
	"database/sql"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	jobservice "scow-adapters/pkg/ai/services/job"
	"scow-adapters/pkg/ai/utils"
)

func newJobMockDB(t *testing.T) (*sql.DB, sqlmock.Sqlmock, *gorm.DB) {
	t.Helper()

	sqlDB, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("create sql mock: %v", err)
	}
	gormDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{SingularTable: true},
		Logger:         logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		sqlDB.Close()
		t.Fatalf("create gorm DB: %v", err)
	}

	return sqlDB, mock, gormDB
}

func queuedJobRows(state string) *sqlmock.Rows {
	return sqlmock.NewRows([]string{"job_db_inx", "account", "state", "new_job_name", "username", "job_type"}).
		AddRow(uint64(1), "account-1", state, "dev-host-1", "user-1", utils.DevHost)
}

func TestCancelQueuedJobDeletesRecordAfterLockedRefresh(t *testing.T) {
	sqlDB, mock, gormDB := newJobMockDB(t)
	defer sqlDB.Close()

	previousDB := client.DB
	client.DB = gormDB
	defer func() { client.DB = previousDB }()

	query := `SELECT .* FROM .*job_table.*job_db_inx = \? AND username = \?.*LIMIT \?`
	mock.ExpectQuery(query).WithArgs(uint32(1), "user-1", 1).WillReturnRows(queuedJobRows(utils.QueuedStatus))
	mock.ExpectQuery(query).WithArgs(uint32(1), "user-1", 1).WillReturnRows(queuedJobRows(utils.QueuedStatus))
	mock.ExpectBegin()
	mock.ExpectExec(`DELETE FROM .*job_table.*job_db_inx = \?`).WithArgs(uint32(1)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	server := &jobservice.ServerJob{}
	if _, err := server.CancelJob(context.Background(), &pb.CancelJobRequest{JobId: 1, UserId: "user-1"}); err != nil {
		t.Fatalf("CancelJob returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestCancelQueuedJobDoesNotDeleteWhenStateChangesDuringLockWait(t *testing.T) {
	sqlDB, mock, gormDB := newJobMockDB(t)
	defer sqlDB.Close()

	previousDB := client.DB
	client.DB = gormDB
	defer func() { client.DB = previousDB }()

	query := `SELECT .* FROM .*job_table.*job_db_inx = \? AND username = \?.*LIMIT \?`
	mock.ExpectQuery(query).WithArgs(uint32(1), "user-1", 1).WillReturnRows(queuedJobRows(utils.QueuedStatus))
	mock.ExpectQuery(query).WithArgs(uint32(1), "user-1", 1).WillReturnRows(queuedJobRows(utils.CanceledStatus))

	server := &jobservice.ServerJob{}
	if _, err := server.CancelJob(context.Background(), &pb.CancelJobRequest{JobId: 1, UserId: "user-1"}); err != nil {
		t.Fatalf("CancelJob returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}
