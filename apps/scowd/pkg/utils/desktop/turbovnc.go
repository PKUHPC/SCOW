package desktop

import (
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

const DISPLAY_ID_PORT_DELTA = 5900

// ParseOTP takes a string stderr, looks for a line starting with a specific indicator,
// and returns the substring following the indicator as the OTP.
// If no line starts with the indicator, it returns an error.
func ParseOTP(stderr string) (string, error) {
	indicator := "Full control one-time password: "
	lines := strings.Split(stderr, "\n")

	for _, line := range lines {
		if strings.HasPrefix(line, indicator) {
			return strings.TrimSpace(line[len(indicator):]), nil
		}
	}

	return "", errors.New("error parsing OTP")
}

// parseDisplayId takes a string stdout, looks for a line that matches
// a specific regular expression pattern, and extracts the display ID as an integer.
// If no matching line is found, it returns an error.
func ParseDisplayID(stdout string) (int, error) {
	regex := regexp.MustCompile(`^Desktop '.*' started on display .*:(\d+)$`)
	lines := strings.Split(stdout, "\n")

	for _, line := range lines {
		matches := regex.FindStringSubmatch(line)
		if matches != nil {
			// Convert the captured group to an integer
			displayId, err := strconv.Atoi(matches[1])
			if err != nil {
				// Handle the case where the conversion fails
				return 0, fmt.Errorf("error converting display id to integer: %v", err)
			}
			return displayId, nil
		}
	}

	// Return an error if no matching line is found
	return 0, fmt.Errorf("error parsing display id from %s", stdout)
}

func DisplayIDToPort(displayID int) int {
	return DISPLAY_ID_PORT_DELTA + displayID
}
