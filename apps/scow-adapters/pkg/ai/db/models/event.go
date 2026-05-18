package models

type EventTable struct {
	ID                 uint   `gorm:"column:_id;primaryKey;autoIncrement"`
	Name               string `validate:"required,min=1,max=200" gorm:"column:name"`
	ObjName            string `validate:"required,min=1,max=200" gorm:"column:obj_name"`
	ObjNamespace       string `gorm:"column:namespace"`
	ObjKind            string `gorm:"column:object_kind"`
	Type               string `gorm:"column:type"`
	Message            string `gorm:"column:message"`
	Reason             string `gorm:"column:reason"`
	ReportingComponent string `gorm:"column:reporting_component"`
	Count              int32  `gorm:"column:count"`
	Created            int64  `gorm:"column:created"`
	Updated            int64  `gorm:"column:updated"`
	JobId              uint64 `gorm:"index;column:job_id"`
	PodUid             string `gorm:"index;column:pod_uid"`
}
