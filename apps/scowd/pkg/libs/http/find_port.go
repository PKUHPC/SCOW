package http

import (
	"strconv"

	"github.com/phayes/freeport"
)

func FindAvailablePort() (string, error) {
	port, err := freeport.GetFreePort()
	if err != nil {
		return "0", err
	}
	return strconv.Itoa(port), nil
}
