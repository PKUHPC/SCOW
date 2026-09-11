package security

import (
	"crypto/md5"
	"encoding/hex"
)

func GenerateMd5(str string) string {
	hash := md5.New()
	hash.Write([]byte(str))
	hashInBytes := hash.Sum(nil)
	return hex.EncodeToString(hashInBytes)
}
