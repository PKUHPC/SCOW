package model

type DesktopInfo struct {
	ID          int    `json:"id"`
	Host        string `json:"host"`
	DisplayID   int    `json:"displayId"`
	DesktopName string `json:"desktopName"`
	Wm          string `json:"wm"`
	CreateTime  string `json:"createTime"`
	IsActive    int    `json:"isActive"`
}
