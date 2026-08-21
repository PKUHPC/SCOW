package main

import (
	"strings"
	"testing"

	utils "scow-adapters/pkg/crane/utils"
)

func TestCheckAccountName(t *testing.T) {
	tests := []struct {
		name    string
		account string
		valid   bool
	}{
		{name: "maximum length", account: strings.Repeat("a", 30), valid: true},
		{name: "too long", account: strings.Repeat("a", 31), valid: false},
		{name: "empty", account: "", valid: false},
		{name: "asterisk", account: "team*", valid: false},
		{name: "dot", account: "team.name", valid: false},
		{name: "dollar", account: "team$name", valid: false},
		{name: "hyphen", account: "team-name", valid: false},
		{name: "space", account: "team name", valid: false},
		{name: "newline", account: "team\nname", valid: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := utils.CheckAccount(tt.account) == nil; got != tt.valid {
				t.Fatalf("CheckAccount(%q) valid = %v, want %v", tt.account, got, tt.valid)
			}
		})
	}
}
