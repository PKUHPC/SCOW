package app

import (
	"encoding/json"
	apiv1 "github.com/PKUHPC/private-scow/apps/scowd/protos/gen/api/application"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type submissionInfo struct {
	UserID           string            `json:"userId"`
	Cluster          string            `json:"cluster"`
	AppID            string            `json:"appId"`
	AppName          string            `json:"appName"`
	Account          string            `json:"account"`
	Partition        *string           `json:"partition,omitempty"`
	QoS              *string           `json:"qos,omitempty"`
	NodeCount        int               `json:"nodeCount"`
	CoreCount        int               `json:"coreCount"`
	GPUCount         *int              `json:"gpuCount,omitempty"`
	MaxTime          int               `json:"maxTime"`
	SubmitTime       *string           `json:"submitTime,omitempty"`
	CustomAttributes map[string]string `json:"customAttributes"`
}

func ParseSubmissionContent(fileContent []byte) (*apiv1.SubmissionInfo, error) {
	// Parse the JSON content into the SubmissionInfo structure
	var info submissionInfo
	if err := json.Unmarshal(fileContent, &info); err != nil {
		return nil, err
	}

	// converts SubmissionInfo to apiv1.SubmissionInfo
	submitTime := (*timestamppb.Timestamp)(nil)
	if info.SubmitTime != nil {
		t, _ := time.Parse(time.RFC3339, *info.SubmitTime)
		submitTime = timestamppb.New(t)
	}

	gpuCount := (*uint32)(nil)
	if info.GPUCount != nil {
		tmp := uint32(*info.GPUCount)
		gpuCount = &tmp
	}

	return &apiv1.SubmissionInfo{
		UserId:           info.UserID,
		Cluster:          info.Cluster,
		AppId:            info.AppID,
		AppName:          info.AppName,
		Account:          info.Account,
		Partition:        info.Partition,
		Qos:              info.QoS,
		CoreCount:        uint32(info.CoreCount),
		MaxTime:          uint32(info.MaxTime),
		SubmitTime:       submitTime,
		CustomAttributes: info.CustomAttributes,
		NodeCount:        uint32(info.NodeCount),
		GpuCount:         gpuCount,
	}, nil
}
