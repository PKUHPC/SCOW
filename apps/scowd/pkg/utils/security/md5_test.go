package security

import (
	"testing"
)

func TestGenerateMd5(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"hello", "5d41402abc4b2a76b9719d911017c592"},
		{"world", "7d793037a0760186574b0282f2f435e7"},
		{"", "d41d8cd98f00b204e9800998ecf8427e"}, // 空字符串的MD5
	}

	for _, test := range tests {
		output := GenerateMd5(test.input)
		if output != test.expected {
			t.Errorf("GenerateMd5(%s) = %s; want %s", test.input, output, test.expected)
		}
	}
}
