package utils

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
)

// SelectAccountExists 查询账户的存在情况，并返回错误
func SelectAccountExists(accountName string) (bool, error) {
	account := models.AcctTable{}
	err := client.DB.Where("name = ? AND deleted = ?", accountName, 0).First(&account).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		} else {
			return false, fmt.Errorf("sql query failed")
		}
	}
	return true, nil
}

// DeleteAccount 删除账户
func DeleteAccount(accountName string) error {
	tx := client.DB.Begin()
	deleted := 1
	// 1. 删除账户表中的账户（软删除）
	result := tx.Model(&models.AcctTable{}).
		Where("name = ? AND deleted = 0", accountName).
		Updates(map[string]interface{}{
			"deleted":  &deleted,
			"mod_time": uint64(time.Now().Unix()),
		})
	if result.Error != nil {
		tx.Rollback()
		return result.Error
	}

	// 2. 删除关联表中的记录（硬删除）
	result = tx.Where("acct = ?", accountName).Delete(&models.AssocTable{})
	if result.Error != nil {
		tx.Rollback()
		return result.Error
	}
	tx.Commit()
	return nil
}

// SelectUserExists 查询用户的存在情况，并返回错误
func SelectUserExists(userName string) (bool, error) {
	user := models.UserTable{}
	err := client.DB.Where("name = ? AND deleted = ?", userName, 0).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		} else {
			return false, fmt.Errorf("sql query failed")
		}
	}
	return true, nil
}

// DeleteUser 删除用户
func DeleteUser(userName string) error {
	user := models.UserTable{}
	err := client.DB.Where("name = ?", userName).Delete(&user).Error
	if err != nil {
		return fmt.Errorf("sql delete failed")
	}
	return nil
}

// CheckUserAndAccountAssociate 在assoc_table表中查看用户和账户是否存在联系
func CheckUserAndAccountAssociate(userName, accountName string) error {
	assoc := models.AssocTable{}
	err := client.DB.Where("acct = ? AND user = ?", accountName, userName).First(&assoc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("the assoc not found")
		} else {
			return fmt.Errorf("sql query failed")
		}
	}
	deleted := assoc.Deleted
	if deleted == 1 {
		return fmt.Errorf("the assoc not found")
	}
	return nil
}

func GetAccountByName(accountName string) (*models.AcctTable, error) {
	var account *models.AcctTable
	err := client.DB.Where("name = ? AND deleted = ?", accountName, 0).First(&account).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("the account %v not found", accountName)
		} else {
			return nil, fmt.Errorf("sql query failed: %v", err)
		}
	}
	return account, nil
}

func GetAccounts() ([]*models.AcctTable, error) {
	var account []*models.AcctTable
	err := client.DB.Where("deleted = ?", 0).Find(&account).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("accounts not found")
		} else {
			return nil, fmt.Errorf("sql query failed: %v", err)
		}
	}
	return account, nil
}

func GetAssociateByAccountName(name string) (*[]models.AssocTable, error) {
	var assoc *[]models.AssocTable
	err := client.DB.Where("acct =? AND deleted = ?", name, 0).Find(&assoc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		} else {
			return nil, fmt.Errorf("sql query failed: %v", err)
		}
	}
	return assoc, nil
}

func GetAssociateByAccountAndUser(accountName, userName string) (*models.AssocTable, error) {
	var assoc *models.AssocTable
	err := client.DB.Where("acct = ? AND user = ?", accountName, userName).First(&assoc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		} else {
			return nil, fmt.Errorf("sql query failed: %v", err)
		}
	}
	return assoc, nil
}

func CreateAccountAndUserAssociate(accountName, userName string) error {
	tx := client.DB.Begin()
	currentTime := time.Now().Unix()
	assocInfo := models.AssocTable{
		CreationTime: uint64(currentTime),
		User:         userName,
		Acct:         accountName,
	}
	if err := tx.Create(&assocInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Commit()
	return nil
}

func GetAccountsNameByUser(userName string) ([]string, error) {
	var (
		accounts []string
		assoc    []models.AssocTable
	)
	err := client.DB.Where("user = ? AND deleted = ?", userName, 0).Find(&assoc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("the assoc not found")
		} else {
			return nil, fmt.Errorf("sql query failed: %v", err)
		}
	}
	for _, acct := range assoc {
		accounts = append(accounts, acct.Acct)
	}
	return accounts, nil
}

// BlockAccount partitions为空表示在所有分区封锁账户， 不为空则是只在非partitions的分区中封锁（账户只有partitions分区的权限）
func BlockAccount(accountName string, partitions string) error {
	return client.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 加锁查询
		var account models.AcctTable
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("name = ?", accountName).
			First(&account).Error; err != nil {
			return err
		}

		// 2. 执行更新
		blocked := 0
		if len(partitions) == 0 {
			blocked = 1
			partitions = ""
		}
		modTime := uint64(time.Now().Unix())
		result := tx.Model(&models.AcctTable{}).
			Where("name = ?", accountName).
			Updates(map[string]interface{}{
				"blocked":    blocked,
				"partitions": partitions,
				"mod_time":   modTime,
			})

		if result.Error != nil {
			return result.Error
		}
		return nil
	})
}

func UnblockAccount(accountName string, partitions string) error {
	return client.DB.Transaction(func(tx *gorm.DB) error {
		// 1. 加锁查询
		var account models.AcctTable
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("name = ?", accountName).
			First(&account).Error; err != nil {
			return err
		}

		// 2. 执行更新
		modTime := uint64(time.Now().Unix())
		result := tx.Model(&models.AcctTable{}).
			Where("name = ?", accountName).
			Updates(map[string]interface{}{
				"blocked":    0,
				"partitions": partitions,
				"mod_time":   modTime,
			})

		if result.Error != nil {
			return result.Error
		}
		return nil
	})
}

func CreateAccount(account string) error {
	tx := client.DB.Begin()
	currentTime := time.Now().Unix()
	accountInfo := models.AcctTable{
		CreationTime: uint64(currentTime),
		Name:         account,
		Description:  "Create account",
	}
	if err := tx.Create(&accountInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Commit()
	return nil
}

func CreateAccountIfUserExits(account, user, partitions string, gpuQuota uint32, blocked int) error {
	tx := client.DB.Begin()
	currentTime := time.Now().Unix()
	accountInfo := models.AcctTable{
		CreationTime: uint64(currentTime),
		Name:         account,
		Partitions:   partitions,
		GpuQuota:     gpuQuota,
		Description:  "Create account",
		Blocked:      blocked,
	}
	if err := tx.Create(&accountInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	assocInfo := models.AssocTable{
		CreationTime: uint64(currentTime),
		User:         user,
		Acct:         account,
	}
	if err := tx.Create(&assocInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Commit()
	return nil
}

func CreateAccountIfUserNotExits(account, user, partitions string, gpuQuota uint32, blocked int) error {
	tx := client.DB.Begin()
	currentTime := time.Now().Unix()
	accountInfo := models.AcctTable{
		CreationTime: uint64(currentTime),
		Name:         account,
		Partitions:   partitions,
		GpuQuota:     gpuQuota,
		Description:  "Create account",
		Blocked:      blocked,
	}
	if err := tx.Create(&accountInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	userInfo := models.UserTable{
		CreationTime: uint64(currentTime),
		Name:         user,
	}
	if err := tx.Create(&userInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	assocInfo := models.AssocTable{
		CreationTime: uint64(currentTime),
		User:         user,
		Acct:         account,
	}
	if err := tx.Create(&assocInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Commit()
	return nil
}

func AddUserToAccount(account, user string) error {
	tx := client.DB.Begin()
	currentTime := time.Now().Unix()

	// 使用 Upsert 方式创建用户
	userInfo := models.UserTable{
		Name:         user,
		CreationTime: uint64(currentTime),
	}
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "name"}}, // 唯一键字段
		DoNothing: true,                            // 存在时不做任何操作
	}).Create(&userInfo).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 使用 Upsert 方式创建关联关系
	assocInfo := models.AssocTable{
		User:         user,
		Acct:         account,
		CreationTime: uint64(currentTime),
	}
	if err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user"}, {Name: "acct"}}, // 联合唯一键
		DoNothing: true,
	}).Create(&assocInfo).Error; err != nil {
		tx.Rollback()
		return err
	}
	tx.Commit()
	return nil
}

func UpdateUserDeletedInAccount(account, user string, deleted int) error {
	modTime := uint64(time.Now().Unix())
	result := client.DB.Model(&models.AssocTable{}).
		Where("user = ? AND acct = ?", user, account).
		Updates(map[string]interface{}{
			"deleted":  deleted,
			"mod_time": modTime,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func UpdateUserBlockedInAccount(user, account string, blocked int) error {
	modTime := uint64(time.Now().Unix())
	result := client.DB.Model(&models.AssocTable{}).
		Where("user = ? AND acct = ?", user, account).
		Updates(map[string]interface{}{
			"blocked":  blocked,
			"mod_time": modTime,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func BlockUserInAccount(userName, accountName string) error {
	modTime := uint64(time.Now().Unix())
	result := client.DB.Model(&models.AssocTable{}).
		Where("user = ? AND acct = ?", userName, accountName).
		Updates(map[string]interface{}{
			"blocked":  1,
			"mod_time": modTime,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func UnblockUserInAccount(userName, accountName string) error {
	modTime := uint64(time.Now().Unix())
	result := client.DB.Model(&models.AssocTable{}).
		Where("user = ? AND acct = ?", userName, accountName).
		Updates(map[string]interface{}{
			"blocked":  0,
			"mod_time": modTime,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// GetAccountUserBlockedInfoInDatabase 从数据库中获取指定账户的用户关联信息,返回key为userName，value为user的blocked值。
func GetAccountUserBlockedInfoInDatabase(account string) (map[string]int, error) {
	var assoc *[]models.AssocTable
	assocInfo := make(map[string]int)
	err := client.DB.Where("acct =? AND deleted = ?", account, 0).Find(&assoc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return assocInfo, nil
		} else {
			return nil, fmt.Errorf("sql query failed: %v", err)
		}
	}
	for _, a := range *assoc {
		assocInfo[a.User] = a.Blocked
	}
	return assocInfo, nil
}

// GetAccountAssociatedUserInDatabase 从数据库中获取指定账户关联的用户, 排除excludeUserList。
func GetAccountAssociatedUserInDatabase(accountName string, excludeUserList []string) ([]string, error) {
	var (
		userList []string
		assoc    []models.AssocTable
	)

	if len(excludeUserList) > 0 {
		err := client.DB.Where("acct = ? AND deleted = ? AND user not in ?", accountName, 0, excludeUserList).Find(&assoc).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("the assoc not found")
			} else {
				return nil, fmt.Errorf("sql query failed: %v", err)
			}
		}
	} else {
		err := client.DB.Where("acct = ? AND deleted = ?", accountName, 0).Find(&assoc).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, fmt.Errorf("the assoc not found")
			} else {
				return nil, fmt.Errorf("sql query failed: %v", err)
			}
		}
	}

	for _, acct := range assoc {
		userList = append(userList, acct.User)
	}
	return userList, nil
}
