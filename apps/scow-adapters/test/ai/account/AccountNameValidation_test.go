package main

import (
	"strings"
	"testing"

	utils "scow-adapters/pkg/ai/utils"
)

func TestCheckAccountName(t *testing.T) {
	tests := []struct {
		name    string
		account string
		valid   bool
	}{
		{name: "letters digits underscore hyphen", account: "team_1-a", valid: true},
		{name: "maximum length", account: strings.Repeat("a", 255), valid: true},
		{name: "empty", account: "", valid: false},
		{name: "too long", account: strings.Repeat("a", 256), valid: false},
		{name: "space", account: "team a", valid: false},
		{name: "percent", account: "team%a", valid: false},
		{name: "quote", account: "team'a", valid: false},
		{name: "semicolon", account: "team;a", valid: false},
		{name: "newline", account: "team\na", valid: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := utils.CheckAccount(tt.account) == nil; got != tt.valid {
				t.Fatalf("CheckAccount(%q) valid = %v, want %v", tt.account, got, tt.valid)
			}
		})
	}
}
