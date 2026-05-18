package models

import (
	v1 "k8s.io/api/core/v1"
)

type PartitionTable struct {
	ID                      uint            `gorm:"column:id;primaryKey;autoIncrement"`
	Name                    string          `gorm:"column:name;unique;index"`
	Created                 int64           `gorm:"column:created"`
	Updated                 int64           `gorm:"column:updated"`
	Weight                  int64           `gorm:"column:weight"`
	State                   string          `gorm:"column:state"`
	Reclaimable             bool            `gorm:"column:reclaimable"`
	CPUCap                  *int64          `gorm:"column:cpu_cap"`
	MemCap                  *int64          `gorm:"column:mem_cap"`
	GPUCap                  *int64          `gorm:"column:gpu_cap"`
	CPUAlloc                *int64          `gorm:"column:cpu_alloc"`
	GPUAlloc                *int64          `gorm:"column:gpu_alloc"`
	MemAlloc                *int64          `gorm:"column:mem_alloc"`
	Type                    string          `gorm:"column:type"`
	AcceleratorDescriptions string          `gorm:"column:accelerator_descriptions"` //加速卡描述，包含驱动和cuda信息
	GPUModel                string          `gorm:"column:gpu_model"`                // GPU型号
	VramMb                  int64           `gorm:"column:vram_mb"`                  //显存
	CPUModel                string          `gorm:"column:cpu_model"`                // CPU 型号
	Deserved                v1.ResourceList `gorm:"-"`
	MaxAcceleratorsPerPod   uint32          `gorm:"column:max_accelerators_per_pod"`
}
