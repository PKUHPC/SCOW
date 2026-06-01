package main

import (
	"testing"

	"scow-adapters/pkg/slurm/utils"
)

func TestGetTimeLimit(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int64
	}{
		// HH:MM:SS 格式
		{name: "HH:MM:SS 1小时30分", input: "01:30:00", want: 90},
		{name: "HH:MM:SS 整2小时", input: "02:00:00", want: 120},
		{name: "HH:MM:SS 秒不计入分钟", input: "00:45:59", want: 45},
		// MM:SS 格式
		{name: "MM:SS 30分", input: "30:00", want: 30},
		{name: "MM:SS 秒不计入分钟", input: "10:59", want: 10},
		// D-HH:MM:SS 格式
		{name: "D-HH:MM:SS 1天", input: "1-00:00:00", want: 1440},
		{name: "D-HH:MM:SS 1天2小时30分", input: "1-02:30:00", want: 1590},
		{name: "D-HH:MM:SS 0天0小时1分", input: "0-00:01:00", want: 1},
		// 纯分钟数
		{name: "纯分钟数 20", input: "20", want: 20},
		// 错误格式，返回 0
		{name: "空字符串", input: "", want: 0},
		{name: "非数字 HH:MM:SS", input: "ab:30:00", want: 0},
		{name: "非数字 D-HH:MM:SS", input: "x-01:00:00", want: 0},
		{name: "D-HH:MM:SS 小时非法", input: "1-aa:00:00", want: 0},
		{name: "分钟数非数字", input: "01:xx:00", want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := utils.GetTimeLimit(tt.input)
			if got != tt.want {
				t.Errorf("GetTimeLimit(%q) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}
