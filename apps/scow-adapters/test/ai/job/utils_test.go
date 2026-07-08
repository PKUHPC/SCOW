package main

import (
	"testing"

	job "scow-adapters/pkg/ai/services/job"
)

func TestEscapeLikePattern(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "plain text", in: "jupyter-20240624", want: "jupyter-20240624"},
		{name: "percent wildcard", in: "job%name", want: `job\%name`},
		{name: "underscore wildcard", in: "job_name", want: `job\_name`},
		{name: "backslash escape char", in: `job\name`, want: `job\\name`},
		{name: "mixed pattern chars", in: `job\_%`, want: `job\\\_\%`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := job.EscapeLikePattern(tt.in); got != tt.want {
				t.Fatalf("EscapeLikePattern(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}
