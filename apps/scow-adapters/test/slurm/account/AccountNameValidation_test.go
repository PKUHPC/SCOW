package main

import (
	"strings"
	"testing"

	utils "scow-adapters/pkg/slurm/utils"
)

func TestCheckAccountName(t *testing.T) {
	tests := []struct {
		name    string
		account string
		valid   bool
	}{
		{name: "single character", account: "a", valid: true},
		{name: "maximum length", account: strings.Repeat("a", 63), valid: true},
		{name: "empty", account: "", valid: false},
		{name: "too long", account: strings.Repeat("a", 64), valid: false},
		{name: "hyphen", account: "a-b", valid: true},
		{name: "uppercase", account: "A", valid: true},
		{name: "leading hyphen", account: "-a", valid: true},
		{name: "space", account: "a b", valid: false},
		{name: "quote", account: "a'b", valid: false},
		{name: "special character", account: "a,b", valid: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := utils.CheckAccount(tt.account) == nil; got != tt.valid {
				t.Fatalf("CheckAccount(%q) valid = %v, want %v", tt.account, got, tt.valid)
			}
		})
	}
}
