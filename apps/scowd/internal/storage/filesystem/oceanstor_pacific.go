package filesystem

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/storage"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// Authentication response structure
type AuthResponse struct {
	Data struct {
		XAuthToken string `json:"x_auth_token"`
		XCsrfToken string `json:"x_csrf_token"`
		SystemEsn  string `json:"system_esn"`
	} `json:"data"`
}

// Storage client configuration
type PacificAdapter struct {
	Username    string
	Password    string
	BaseURL     string
	AuthToken   string
	CsrfToken   string
	NamespaceID string
	HttpClient  *http.Client
	logger      *logrus.Entry
}

type SetQuotaResponse struct {
	Result struct {
		Code        int32   `json:"code"`
		Description *string `json:"description"`
		Suggestion  *string `json:"suggestion"`
	} `json:"result"`
}

// Quota response structure
type GetQuotaResponse struct {
	Data []struct {
		ID              string `json:"id"`
		SoftGraceTime   uint32 `json:"soft_grace_time"`
		SpaceHardQuota  uint64 `json:"space_hard_quota"`
		SpaceSoftQuota  uint64 `json:"space_soft_quota"`
		SpaceUnitType   uint32 `json:"space_unit_type"`
		SpaceUsed       uint64 `json:"space_used"`
		UsrGrpOwnerName string `json:"usr_grp_owner_name"`
	} `json:"data"`
	Result struct {
		Code        int    `json:"code"`
		Description string `json:"description"`
	} `json:"result"`
}

// Create quota response structure
type CreateQuotaResponse struct {
	Data struct {
		ID             string `json:"id"`
		ParentID       string `json:"parent_id"`
		ParentType     int    `json:"parent_type"`
		QuotaType      int    `json:"quota_type"`
		SpaceHardQuota uint64 `json:"space_hard_quota"`
		SpaceUnitType  uint32 `json:"space_unit_type"`
		FileHardQuota  uint64 `json:"file_hard_quota"`
	} `json:"data"`
	Result struct {
		Code        int    `json:"code"`
		Description string `json:"description"`
	} `json:"result"`
}

// Initialize storage client (enhanced)
// NewPacificAdapter 创建 OceanStor Pacific 适配器实例
func NewPacificAdapter(path string, cfg *apiv1.OceanStorPacificConfig, logger *logrus.Entry) (*PacificAdapter, error) {
	logger.WithFields(logrus.Fields{
		"NamespaceID": cfg.NamespaceId,
		"BaseUrl":     cfg.BaseUrl,
	}).Debug("[DEBUG] NewPacificAdapter: Starting initialization")

	if strings.TrimSpace(cfg.NamespaceId) == "" || strings.TrimSpace(cfg.BaseUrl) == "" {
		logger.Error("Missing required configuration parameters")
		return nil, errors.New("missing required parameters: namespace_id or base_url")
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 20,
			TLSClientConfig: &tls.Config{
				// MinVersion:         tls.VersionTLS12,
				InsecureSkipVerify: true,
			},
		},
	}

	return &PacificAdapter{
		NamespaceID: cfg.NamespaceId,
		Username:    cfg.Username,
		Password:    cfg.Password,
		BaseURL:     strings.TrimRight(cfg.BaseUrl, "/"),
		HttpClient:  client,
		logger:      logger,
	}, nil
}

// Authentication process
func (c *PacificAdapter) Login() error {
	authURL := c.BaseURL + "/api/v2/aa/sessions"

	c.logger.WithFields(logrus.Fields{
		"auth_url": authURL,
		"username": c.Username,
		"base_url": c.BaseURL,
	}).Debug("[DEBUG] Login: Starting authentication process")

	authData := map[string]string{
		"user_name": c.Username,
		"password":  c.Password,
		"scope":     "0",
	}

	jsonData, _ := json.Marshal(authData)
	// 登录载荷包含密码，不写入日志。
	c.logger.Debug("[DEBUG] Login: Sending authentication request")

	req, _ := http.NewRequest("POST", authURL, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		c.logger.WithFields(logrus.Fields{
			"url":  authURL,
			"user": c.Username,
		}).Errorf("Authentication request failed: %v", err)
		return fmt.Errorf("authentication request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		c.logger.WithFields(logrus.Fields{
			"status_code": resp.StatusCode,
			"url":         authURL,
		}).Error("Unexpected authentication response")
		return fmt.Errorf("authentication failed with status code: %d", resp.StatusCode)
	}

	var authResp AuthResponse
	body, _ := io.ReadAll(resp.Body)
	c.logger.WithFields(logrus.Fields{
		"status_code": resp.StatusCode,
	}).Debug("[DEBUG] Login: Received authentication response")

	if err := json.Unmarshal(body, &authResp); err != nil {
		// 响应及解析错误可能包含 token 或服务端回显的凭据，日志和返回错误均不带原文。
		c.logger.WithFields(logrus.Fields{
			"status_code": resp.StatusCode,
			"error_type":  fmt.Sprintf("%T", err),
		}).Error("Failed to parse auth response")
		return errors.New("failed to parse authentication response")
	}

	c.AuthToken = authResp.Data.XAuthToken
	c.CsrfToken = authResp.Data.XCsrfToken

	c.logger.WithFields(logrus.Fields{
		"auth_token_length": len(c.AuthToken),
		"csrf_token_length": len(c.CsrfToken),
	}).Debug("[DEBUG] Login: Authentication successful, tokens obtained")

	return nil
}

// Retrieve user quota
func (c *PacificAdapter) GetQuota(user string, path string) (QuotaInfo, string, error) {
	c.logger.WithFields(logrus.Fields{
		"user":         user,
		"path":         path,
		"namespace_id": c.NamespaceID,
	}).Debug("[DEBUG] GetQuota: Starting quota retrieval")

	quotaURL := c.BaseURL + "/api/v2/converged_service/quota"

	queryParams := map[string]interface{}{
		"parent_type": 40,
		"parent_id":   c.NamespaceID,
		"range":       map[string]int{"offset": 0, "limit": 1},
		"filter":      map[string]string{"usr_grp_owner_name": user},
	}

	jsonParams, _ := json.Marshal(queryParams)
	c.logger.WithFields(logrus.Fields{
		"quota_url":    quotaURL,
		"query_params": string(jsonParams),
	}).Debug("[DEBUG] GetQuota: Sending quota query request")

	req, _ := http.NewRequest("GET", quotaURL, bytes.NewBuffer(jsonParams))
	c.setAuthHeaders(req)

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		c.logger.WithFields(logrus.Fields{
			"user": user,
			"path": path,
		}).Errorf("Quota query request failed: %v", err)
		return QuotaInfo{}, "", fmt.Errorf("quota query request failed: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	c.logger.WithFields(logrus.Fields{
		"response_body": string(body),
		"status_code":   resp.StatusCode,
	}).Debug("[DEBUG] GetQuota: Received quota response")

	var quotaResp GetQuotaResponse
	if err := json.Unmarshal(body, &quotaResp); err != nil {
		c.logger.WithField("url", quotaURL).Errorf("Response decoding failed: %v", err)
		return QuotaInfo{}, "", fmt.Errorf("failed to decode response: %v", err)
	}

	if quotaResp.Result.Code != 0 {
		c.logger.WithFields(logrus.Fields{
			"error_code": quotaResp.Result.Code,
			"user":       user,
		}).Error("API returned error code")
		return QuotaInfo{}, "", fmt.Errorf("API error code: %d", quotaResp.Result.Code)
	}

	// 遍历数组查找匹配用户名的配额记录
	var data *struct {
		ID              string `json:"id"`
		SoftGraceTime   uint32 `json:"soft_grace_time"`
		SpaceHardQuota  uint64 `json:"space_hard_quota"`
		SpaceSoftQuota  uint64 `json:"space_soft_quota"`
		SpaceUnitType   uint32 `json:"space_unit_type"`
		SpaceUsed       uint64 `json:"space_used"`
		UsrGrpOwnerName string `json:"usr_grp_owner_name"`
	}

	for i := range quotaResp.Data {
		if quotaResp.Data[i].UsrGrpOwnerName == user {
			data = &quotaResp.Data[i]
			break
		}
	}

	if data == nil {
		c.logger.WithFields(logrus.Fields{
			"user":             user,
			"available_quotas": len(quotaResp.Data),
		}).Info("No matching quota found for user, returning empty quota info")
		return QuotaInfo{}, "", nil
	}

	c.logger.WithFields(logrus.Fields{
		"quota_data":         data,
		"space_soft_quota":   data.SpaceSoftQuota,
		"space_hard_quota":   data.SpaceHardQuota,
		"space_unit_type":    data.SpaceUnitType,
		"soft_grace_time":    data.SoftGraceTime,
		"space_used":         data.SpaceUsed,
		"quota_id":           data.ID,
		"usr_grp_owner_name": data.UsrGrpOwnerName,
	}).Debug("[DEBUG] GetQuota: Processing quota data")

	unitType := uint32(data.SpaceUnitType)
	graceTime := uint32(data.SoftGraceTime)

	unitMultiplier := map[uint32]uint64{
		0: 1,
		1: 1 << 10,
		2: 1 << 20,
		3: 1 << 30,
	}[unitType]

	return QuotaInfo{
		Filesystem:            "OceanStor Pacific",
		UserID:                user,
		BlockUsedStorageBytes: data.SpaceUsed * unitMultiplier,
		BlockSoftLimitBytes:   data.SpaceSoftQuota * unitMultiplier,
		BlockHardLimitBytes:   data.SpaceHardQuota * unitMultiplier,
		BlockGraceDays:        int(graceTime),
	}, data.ID, nil
}

// Update quota configuration
func (c *PacificAdapter) setQuota(quotaID string, spaceHardBytes uint64) error {
	c.logger.WithFields(logrus.Fields{
		"quota_id":         quotaID,
		"space_hard_bytes": spaceHardBytes,
		"space_hard_gb":    float64(spaceHardBytes) / 1e9,
	}).Debug("[DEBUG] setQuota: Starting quota update")

	updateURL := c.BaseURL + "/api/v2/converged_service/quota"

	payload := map[string]interface{}{
		"id":               quotaID,
		"space_hard_quota": spaceHardBytes,
		"space_unit_type":  0,
	}

	jsonData, _ := json.Marshal(payload)
	c.logger.WithFields(logrus.Fields{
		"update_url": updateURL,
		"payload":    string(jsonData),
	}).Debug("[DEBUG] setQuota: Sending quota update request")

	req, _ := http.NewRequest("PUT", updateURL, bytes.NewBuffer(jsonData))
	c.setAuthHeaders(req)

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		c.logger.WithFields(logrus.Fields{
			"quota_id": quotaID,
			"payload":  string(jsonData),
		}).Errorf("Update request failed: %v", err)
		return fmt.Errorf("quota update request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		c.logger.WithFields(logrus.Fields{
			"status_code": resp.StatusCode,
			"quota_id":    quotaID,
		}).Error("Unexpected HTTP response")
		return fmt.Errorf("HTTP error code: %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	c.logger.WithFields(logrus.Fields{
		"response_body": string(body),
		"status_code":   resp.StatusCode,
	}).Debug("[DEBUG] setQuota: Received quota update response")

	var response SetQuotaResponse
	if err := json.Unmarshal(body, &response); err != nil {
		c.logger.WithField("url", updateURL).Errorf("Failed to parse response: %v", err)
		return fmt.Errorf("failed to parse JSON response: %v", err)
	}

	if response.Result.Code != 0 {
		c.logger.WithFields(logrus.Fields{
			"error_code":    response.Result.Code,
			"description":   response.Result.Description,
			"suggestion":    response.Result.Suggestion,
			"original_size": spaceHardBytes,
		}).Error("Quota update operation failed")
		return fmt.Errorf("operation failed with code: %d", response.Result.Code)
	}

	return nil
}

// Batch retrieve user quotas
func (c *PacificAdapter) GetUsersQuota(users []string, path string) ([]QuotaInfo, error) {
	err := c.Login()
	if err != nil {
		c.logger.WithError(err).Error("Failed to initialize storage session")
		return nil, err
	}

	var quotaInfos []QuotaInfo
	for _, user := range users {
		quotaInfo, _, err := c.GetQuota(user, path)
		if err != nil {
			c.logger.WithFields(logrus.Fields{
				"user": user,
				"path": path,
			}).Error("Failed to retrieve user quota")
			continue
		}
		quotaInfos = append(quotaInfos, quotaInfo)
	}
	return quotaInfos, nil
}

// Set individual user quota
func (c *PacificAdapter) SetUserQuota(user string, path string, hardBytes, softBytes uint64, graceDays int) error {
	err := c.Login()
	if err != nil {
		c.logger.WithError(err).Error("Storage authentication failure")
		return err
	}

	_, quotaID, err := c.GetQuota(user, path)
	if err != nil {
		c.logger.WithFields(logrus.Fields{
			"user": user,
			"path": path,
		}).Error("Failed to locate quota entry")
		return err
	}

	// quotaID 为空表示用户还未创建过配额
	if quotaID == "" {
		// 为用户创建配额
		quotaID, err = c.createQuota(user, hardBytes)
		if err != nil {
			c.logger.WithFields(logrus.Fields{
				"user": user,
				"path": path,
			}).Errorf("Failed to create quota for user: %v", err)
			return err
		}
		c.logger.WithFields(logrus.Fields{
			"user":     user,
			"quota_id": quotaID,
		}).Info("Successfully created quota for user")

	} else {
		err = c.setQuota(quotaID, hardBytes)
		if err != nil {
			c.logger.WithFields(logrus.Fields{
				"user":     user,
				"quota_id": quotaID,
				"hard_gb":  hardBytes / 1e9,
			}).Errorf("Quota update failed: %v", err)
			return err
		}
	}

	return nil
}

// Batch update user quotas
func (c *PacificAdapter) SetUsersQuota(users []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error) {
	err := c.Login()
	if err != nil {
		c.logger.WithError(err).Error("Storage system login failed")
		return nil, nil, err
	}

	successUsers := make([]string, 0)
	failedUsers := make([]string, 0)

	for _, user := range users {
		_, quotaID, err := c.GetQuota(user, path)
		if err != nil {
			c.logger.WithError(err).Error("Failed to retrieve quota configuration")
			return nil, nil, err
		}

		// quotaID 为空表示用户还未创建过配额
		if quotaID == "" {
			// 为用户创建配额
			quotaID, err = c.createQuota(user, hardBytes)
			if err != nil {
				c.logger.WithFields(logrus.Fields{
					"user": user,
					"path": path,
				}).Errorf("Failed to create quota for user: %v", err)
				failedUsers = append(failedUsers, user)
				continue
			}
			c.logger.WithFields(logrus.Fields{
				"user":     user,
				"quota_id": quotaID,
			}).Info("Successfully created quota for user")
		} else {
			err = c.setQuota(quotaID, hardBytes)
			if err != nil {
				c.logger.Errorf("Quota update failed for user %s: %v", user, err) // Modified
				failedUsers = append(failedUsers, user)
				continue
			}
		}

		successUsers = append(successUsers, user)
	}

	return successUsers, failedUsers, nil
}

// Create quota for user
func (c *PacificAdapter) createQuota(user string, spaceHardBytes uint64) (string, error) {
	logrus.WithFields(logrus.Fields{
		"user":             user,
		"space_hard_bytes": spaceHardBytes,
		"space_hard_gb":    float64(spaceHardBytes) / 1e9,
		"namespace_id":     c.NamespaceID,
	}).Debug("[DEBUG] createQuota: Starting quota creation")

	createURL := c.BaseURL + "/api/v2/converged_service/quota"

	payload := map[string]interface{}{
		"parent_type":            40,
		"parent_id":              c.NamespaceID,
		"quota_type":             2,
		"directory_quota_target": 1,
		"space_hard_quota":       fmt.Sprintf("%d", spaceHardBytes),
		"space_unit_type":        "0",
		"usr_grp_owner_name":     user,
		"usr_grp_type":           3,
		"domain_type":            2,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		c.logger.WithField("payload", payload).Errorf("Failed to marshal create quota payload: %v", err)
		return "", fmt.Errorf("failed to marshal payload: %v", err)
	}

	c.logger.WithFields(logrus.Fields{
		"create_url": createURL,
		"payload":    string(jsonData),
	}).Debug("[DEBUG] createQuota: Sending quota creation request")

	req, err := http.NewRequest("POST", createURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}
	c.setAuthHeaders(req)

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		c.logger.WithFields(logrus.Fields{
			"user":    user,
			"payload": string(jsonData),
		}).Errorf("Create quota request failed: %v", err)
		return "", fmt.Errorf("create quota request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		c.logger.WithFields(logrus.Fields{
			"status_code": resp.StatusCode,
			"user":        user,
			"response":    string(body),
		}).Error("Unexpected HTTP response when creating quota")
		return "", fmt.Errorf("HTTP error code: %d, response: %s", resp.StatusCode, string(body))
	}

	body, _ := io.ReadAll(resp.Body)
	c.logger.WithFields(logrus.Fields{
		"response_body": string(body),
		"status_code":   resp.StatusCode,
	}).Debug("[DEBUG] createQuota: Received quota creation response")

	var response CreateQuotaResponse
	if err := json.Unmarshal(body, &response); err != nil {
		c.logger.WithField("url", createURL).Errorf("Failed to parse create quota response: %v", err)
		return "", fmt.Errorf("failed to parse JSON response: %v", err)
	}

	if response.Result.Code != 0 {
		c.logger.WithFields(logrus.Fields{
			"error_code":  response.Result.Code,
			"description": response.Result.Description,
			"user":        user,
			"space_hard":  spaceHardBytes,
		}).Error("Create quota operation failed")
		return "", fmt.Errorf("operation failed with code: %d, description: %s", response.Result.Code, response.Result.Description)
	}

	c.logger.WithFields(logrus.Fields{
		"user":        user,
		"quota_id":    response.Data.ID,
		"space_bytes": spaceHardBytes,
	}).Info("Successfully created quota")

	return response.Data.ID, nil
}

// GetGroupQuota retrieves quota info for a group
func (c *PacificAdapter) GetGroupQuota(group string, path string) (GroupQuotaInfo, string, error) {
	c.logger.WithFields(logrus.Fields{
		"group":        group,
		"path":         path,
		"namespace_id": c.NamespaceID,
	}).Debug("GetGroupQuota: Starting quota retrieval")

	quotaURL := c.BaseURL + "/api/v2/converged_service/quota"

	queryParams := map[string]interface{}{
		"parent_type": 40,
		"parent_id":   c.NamespaceID,
		"range":       map[string]int{"offset": 0, "limit": 1},
		"filter":      map[string]string{"usr_grp_owner_name": group},
	}

	jsonParams, err := json.Marshal(queryParams)
	if err != nil {
		return GroupQuotaInfo{}, "", fmt.Errorf("marshal query params: %w", err)
	}
	req, err := http.NewRequest("GET", quotaURL, bytes.NewBuffer(jsonParams))
	if err != nil {
		return GroupQuotaInfo{}, "", fmt.Errorf("create request: %w", err)
	}
	c.setAuthHeaders(req)

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		return GroupQuotaInfo{}, "", fmt.Errorf("quota query request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return GroupQuotaInfo{}, "", fmt.Errorf("read response body: %w", err)
	}

	var quotaResp GetQuotaResponse
	if err := json.Unmarshal(body, &quotaResp); err != nil {
		return GroupQuotaInfo{}, "", fmt.Errorf("failed to decode response: %v", err)
	}

	if quotaResp.Result.Code != 0 {
		return GroupQuotaInfo{}, "", fmt.Errorf("API error code: %d", quotaResp.Result.Code)
	}

	for i := range quotaResp.Data {
		if quotaResp.Data[i].UsrGrpOwnerName == group {
			data := &quotaResp.Data[i]

			unitType := uint32(data.SpaceUnitType)
			graceTime := uint32(data.SoftGraceTime)

			unitMultiplier, ok := map[uint32]uint64{
				0: 1,
				1: 1 << 10,
				2: 1 << 20,
				3: 1 << 30,
			}[unitType]
			if !ok {
				return GroupQuotaInfo{}, "", fmt.Errorf("unknown SpaceUnitType %d for group %s", unitType, group)
			}

			return GroupQuotaInfo{
				Filesystem:            "OceanStor Pacific",
				GroupName:             group,
				BlockUsedStorageBytes: data.SpaceUsed * unitMultiplier,
				BlockSoftLimitBytes:   data.SpaceSoftQuota * unitMultiplier,
				BlockHardLimitBytes:   data.SpaceHardQuota * unitMultiplier,
				BlockGraceDays:        int(graceTime),
			}, data.ID, nil
		}
	}

	return GroupQuotaInfo{}, "", nil
}

// createGroupQuota creates a new group quota entry
func (c *PacificAdapter) createGroupQuota(group string, spaceHardBytes uint64) (string, error) {
	createURL := c.BaseURL + "/api/v2/converged_service/quota"

	payload := map[string]interface{}{
		"parent_type":            40,
		"parent_id":              c.NamespaceID,
		"quota_type":             3,
		"directory_quota_target": 1,
		"space_hard_quota":       fmt.Sprintf("%d", spaceHardBytes),
		"space_unit_type":        "0",
		"usr_grp_owner_name":     group,
		"usr_grp_type":           2,
		"domain_type":            2,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %v", err)
	}

	req, err := http.NewRequest("POST", createURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}
	c.setAuthHeaders(req)

	resp, err := c.HttpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("create group quota request failed: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP error code: %d, response: %s", resp.StatusCode, string(body))
	}

	var response CreateQuotaResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return "", fmt.Errorf("failed to parse JSON response: %v", err)
	}

	if response.Result.Code != 0 {
		return "", fmt.Errorf("operation failed with code: %d, description: %s", response.Result.Code, response.Result.Description)
	}

	return response.Data.ID, nil
}

// GetGroupsQuota retrieves quota info for multiple groups
func (c *PacificAdapter) GetGroupsQuota(groups []string, path string) ([]GroupQuotaInfo, error) {
	err := c.Login()
	if err != nil {
		c.logger.WithError(err).Error("Failed to initialize storage session")
		return nil, err
	}

	var quotaInfos []GroupQuotaInfo
	for _, group := range groups {
		quotaInfo, _, err := c.GetGroupQuota(group, path)
		if err != nil {
			c.logger.WithFields(logrus.Fields{
				"group": group,
				"path":  path,
			}).Error("Failed to retrieve group quota")
			continue
		}
		quotaInfos = append(quotaInfos, quotaInfo)
	}
	return quotaInfos, nil
}

// SetGroupQuota sets quota for a single group
func (c *PacificAdapter) SetGroupQuota(group string, path string, hardBytes, softBytes uint64, graceDays int) error {
	err := c.Login()
	if err != nil {
		c.logger.WithError(err).Error("Storage authentication failure")
		return err
	}

	_, quotaID, err := c.GetGroupQuota(group, path)
	if err != nil {
		return err
	}

	if quotaID == "" {
		if _, err = c.createGroupQuota(group, hardBytes); err != nil {
			c.logger.WithFields(logrus.Fields{
				"group": group,
				"path":  path,
			}).Errorf("Failed to create quota for group: %v", err)
			return err
		}
	} else {
		if err = c.setQuota(quotaID, hardBytes); err != nil {
			c.logger.WithFields(logrus.Fields{
				"group":    group,
				"quota_id": quotaID,
			}).Errorf("Quota update failed: %v", err)
			return err
		}
	}

	return nil
}

// SetGroupsQuota sets quota for multiple groups
func (c *PacificAdapter) SetGroupsQuota(groups []string, path string, hardBytes, softBytes uint64, graceDays int) ([]string, []string, error) {
	err := c.Login()
	if err != nil {
		c.logger.WithError(err).Error("Storage system login failed")
		return nil, nil, err
	}

	successGroups := make([]string, 0)
	failedGroups := make([]string, 0)

	for _, group := range groups {
		_, quotaID, err := c.GetGroupQuota(group, path)
		if err != nil {
			c.logger.WithError(err).Errorf("SetGroupsQuota: failed to retrieve quota for group %s", group)
			failedGroups = append(failedGroups, group)
			continue
		}

		if quotaID == "" {
			if _, err = c.createGroupQuota(group, hardBytes); err != nil {
				c.logger.WithFields(logrus.Fields{
					"group": group,
				}).Errorf("Failed to create quota for group: %v", err)
				failedGroups = append(failedGroups, group)
				continue
			}
		} else {
			if err = c.setQuota(quotaID, hardBytes); err != nil {
				c.logger.Errorf("Quota update failed for group %s: %v", group, err)
				failedGroups = append(failedGroups, group)
				continue
			}
		}

		successGroups = append(successGroups, group)
	}

	return successGroups, failedGroups, nil
}

// Set authentication headers
func (c *PacificAdapter) setAuthHeaders(req *http.Request) {
	c.logger.WithFields(logrus.Fields{
		"auth_token_length": len(c.AuthToken),
		"csrf_token_length": len(c.CsrfToken),
		"request_url":       req.URL.String(),
		"request_method":    req.Method,
	}).Debug("[DEBUG] setAuthHeaders: Setting authentication headers")

	req.Header.Set("X-Auth-Token", c.AuthToken)
	req.Header.Set("X_CSRF_Token", c.CsrfToken)
	req.Header.Set("Content-Type", "application/json")
}
