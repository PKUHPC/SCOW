package version

import (
	"context"
	"strconv"
	"strings"

	"github.com/sirupsen/logrus"

	protos "scow-adapters/gen/go"
	"scow-adapters/pkg/common/utils"
)

type ServerVersion struct {
	protos.UnimplementedVersionServiceServer
}

// GetVersion means get version
func (s *ServerVersion) GetVersion(ctx context.Context, in *protos.GetVersionRequest) (*protos.GetVersionResponse, error) {
	logrus.Infof("Received request GetVersion: %v", in)
	tagPart := strings.SplitN(strings.TrimPrefix(utils.Version, "v"), "-", 2)[0]
	versionSlice := strings.Split(tagPart, ".")
	if len(versionSlice) == 3 {
		major, _ := strconv.Atoi(versionSlice[0])
		minor, _ := strconv.Atoi(versionSlice[1])
		patch, _ := strconv.Atoi(versionSlice[2])
		return &protos.GetVersionResponse{Major: uint32(major), Minor: uint32(minor), Patch: uint32(patch)}, nil
	}
	logrus.Infof("versionSlice: %v", versionSlice)
	return &protos.GetVersionResponse{Major: 1, Minor: 11, Patch: 0}, nil
}
