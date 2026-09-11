package utils

import (
	"fmt"
	"strconv"
)

func StringToUint32(s string) (uint32, error) {
	val, err := strconv.ParseUint(s, 10, 32)
	if err != nil {
		return 0, fmt.Errorf("conversion failed[%s]: %v", s, err)
	}
	return uint32(val), nil
}
