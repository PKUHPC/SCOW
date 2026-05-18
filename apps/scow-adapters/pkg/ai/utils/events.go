package utils

import (
	"time"

	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"

	pb "scow-adapters/gen/go"
	"scow-adapters/pkg/ai/client"
	"scow-adapters/pkg/ai/db/models"
)

func GetEventsById(condition string, kind string) (events []*pb.PodEvent) {
	var (
		modelsEvents []*models.EventTable
		err          error
	)
	logrus.Tracef("condition %s, kind %s", condition, kind)
	switch kind {
	case Pod:
		err = client.DB.Where("pod_uid = ?", condition).Find(&modelsEvents).Error
	case Job:
		err = client.DB.Where("job_id = ?", condition).Find(&modelsEvents).Error
	default:
		logrus.Errorf("get events failed, not support kind %s", kind)
		return
	}
	if err != nil {
		logrus.Errorf("Get events  failed due to %v", err)
		return
	}
	events = make([]*pb.PodEvent, 0, len(modelsEvents))
	for _, event := range modelsEvents {
		ev := &pb.PodEvent{
			ObjKind:            event.ObjKind,
			ObjName:            &event.ObjName,
			ObjNamespace:       &event.ObjNamespace,
			Type:               event.Type,
			Message:            event.Message,
			Reason:             event.Reason,
			ReportingComponent: event.ReportingComponent,
			Count:              &event.Count,
			Time:               timestamppb.New(time.Unix(event.Created, 0)),
		}
		events = append(events, ev)
	}
	return events
}
