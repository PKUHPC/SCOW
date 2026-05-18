package quota_cli

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
	qw "scow-adapters/pkg/ai/services/job"
	"scow-adapters/pkg/ai/utils"
)

func GetAccounts(accountName string) ([]*models.AcctTable, error) {
	var accounts []*models.AcctTable

	if accountName != "" {
		as := strings.Split(accountName, ",")
		for _, a := range as {
			account, err := utils.GetAccountByName(a)
			if err != nil {
				return nil, err
			}
			accounts = append(accounts, account)
		}
	} else {
		as, err := utils.GetAccounts()
		if err != nil {
			return nil, err
		}
		accounts = as
	}

	return accounts, nil
}

func UpdateGpuQuota(accountName string, quota uint32) error {
	accounts := strings.Split(accountName, ",")
	if len(accounts) == 1 {
		increase, err := updateSingleAccountQuota(accountName, quota)
		if err != nil {
			return err
		} else if increase {
			// 触发运行QUEUED作业
			qw.TryResubmitJob(accountName)
		}
		return nil
	}

	return updateMultiAccountGpuQuota(accounts, quota)
}

// 更新多个账户
func updateMultiAccountGpuQuota(accountNames []string, quota uint32) error {
	var errs []string
	for _, name := range accountNames {
		increase, err := updateSingleAccountQuota(name, quota)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", name, err))
		} else if increase {
			// 触发运行QUEUED作业
			qw.TryResubmitJob(name)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("update failed: %s", strings.Join(errs, "; "))
	}
	return nil
}

// 更新单个账户, 返回是否是增加配额以及错误
func updateSingleAccountQuota(accountName string, quota uint32) (bool, error) {
	var increase bool
	err := client.DB.Transaction(func(tx *gorm.DB) error {
		var acc models.AcctTable
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("name = ?", accountName).
			First(&acc).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return fmt.Errorf("account %s does not exist", accountName)
			}
			return fmt.Errorf("query account failed: %w", err)
		}

		// 值没变直接跳过
		if acc.GpuQuota == quota {
			return nil
		}

		// 值变大
		if acc.GpuQuota < quota {
			increase = true
		}

		// 执行单条更新
		modTime := uint64(time.Now().Unix())
		if err := tx.Model(&acc).
			Where("name = ?", accountName).
			Updates(map[string]interface{}{
				"gpu_quota": quota,
				"mod_time":  modTime,
			}).Error; err != nil {
			return fmt.Errorf("update account %s failed: %w", accountName, err)
		}

		logrus.Infof("account %v GPU quota has been updated to %v", accountName, quota)

		return nil
	})

	return increase, err
}
