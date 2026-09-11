package filesystem

import (
	apiv1 "scowd/protos/gen/api/storage"

	"github.com/sirupsen/logrus"
)

// NewAdapter 适配器工厂 - 根据挂载点路径和 protobuf StorageConfig 创建对应的文件系统适配器
// path: 挂载点路径，storage: scow 端传递的存储配置信息
func NewAdapter(path string, storage *apiv1.StorageConfig) (FileSystemAdapter, error) {
	if storage == nil || storage.FsConfig == nil {
		return nil, ErrInvalidConfig
	}
	log := logrus.WithFields(logrus.Fields{
		"storageId": storage.StorageId,
		"path":      path,
	})

	switch cfg := storage.FsConfig.(type) {
	case *apiv1.StorageConfig_Nfs:
		if checkVersionCompatible(cfg.Nfs.Version, ">=3.0") {
			return NewNfsAdapter(path, cfg.Nfs, log)
		}
		return nil, ErrUnsupportedVersion
	case *apiv1.StorageConfig_Lfs:
		if checkVersionCompatible(cfg.Lfs.Version, ">=2.0") {
			return NewLfsAdapter(path, cfg.Lfs, log)
		}
		return nil, ErrUnsupportedVersion
	case *apiv1.StorageConfig_Gpfs:
		if checkVersionCompatible(cfg.Gpfs.Version, ">=4.0") {
			return NewGpfsAdapter(path, cfg.Gpfs, log)
		}
		return nil, ErrUnsupportedVersion
	case *apiv1.StorageConfig_OceanStorPacific:
		if checkVersionCompatible(cfg.OceanStorPacific.Version, ">=8.2.1") {
			return NewPacificAdapter(path, cfg.OceanStorPacific, log)
		}
		return nil, ErrUnsupportedVersion
	default:
		return nil, ErrUnsupportedFilesystem
	}
}
