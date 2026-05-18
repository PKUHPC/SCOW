package inference

import (
	"testing"

	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

func TestAddResource(t *testing.T) {
	tests := []struct {
		name          string
		inputRes      *corev1.ResourceRequirements
		resourceName  corev1.ResourceName
		quantity      string
		expectedReq   corev1.ResourceList
		expectedLimit corev1.ResourceList
		expectError   bool
	}{
		{
			name:         "AddToEmptyResources",
			inputRes:     &corev1.ResourceRequirements{},
			resourceName: "nvidia.com/gpu",
			quantity:     "1",
			expectedReq: corev1.ResourceList{
				"nvidia.com/gpu": resource.MustParse("1"),
			},
			expectedLimit: corev1.ResourceList{
				"nvidia.com/gpu": resource.MustParse("1"),
			},
			expectError: false,
		},
		{
			name: "AddToExistingResources",
			inputRes: &corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					"cpu": resource.MustParse("500m"),
				},
				Limits: corev1.ResourceList{
					"cpu": resource.MustParse("1"),
				},
			},
			resourceName: "memory",
			quantity:     "1Gi",
			expectedReq: corev1.ResourceList{
				"cpu":    resource.MustParse("500m"),
				"memory": resource.MustParse("1Gi"),
			},
			expectedLimit: corev1.ResourceList{
				"cpu":    resource.MustParse("1"),
				"memory": resource.MustParse("1Gi"),
			},
			expectError: false,
		},
		{
			name:         "InvalidQuantity",
			inputRes:     &corev1.ResourceRequirements{},
			resourceName: "gpu",
			quantity:     "invalid",
			expectError:  true,
		},
		{
			name:         "NilResourceRequirements",
			inputRes:     nil,
			resourceName: "gpu",
			quantity:     "1",
			expectError:  true,
		},
		{
			name: "OverrideExistingResource",
			inputRes: &corev1.ResourceRequirements{
				Requests: corev1.ResourceList{
					"gpu": resource.MustParse("2"),
				},
				Limits: corev1.ResourceList{
					"gpu": resource.MustParse("2"),
				},
			},
			resourceName: "gpu",
			quantity:     "4",
			expectedReq: corev1.ResourceList{
				"gpu": resource.MustParse("4"),
			},
			expectedLimit: corev1.ResourceList{
				"gpu": resource.MustParse("4"),
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// 深拷贝inputRes以避免测试间相互影响
			var inputCopy *corev1.ResourceRequirements
			if tt.inputRes != nil {
				copy := *tt.inputRes
				inputCopy = &copy
			} else {
				inputCopy = nil
			}

			err := AddResource(inputCopy, tt.resourceName, tt.quantity)

			if tt.expectError {
				assert.Error(t, err)
				return
			}

			assert.NoError(t, err)
			assert.Equal(t, tt.expectedReq, inputCopy.Requests)
			assert.Equal(t, tt.expectedLimit, inputCopy.Limits)
		})
	}
}

func TestAddResourceEdgeCases(t *testing.T) {
	t.Run("EmptyQuantity", func(t *testing.T) {
		res := &corev1.ResourceRequirements{}
		err := AddResource(res, "cpu", "")
		assert.Error(t, err)
	})

	t.Run("ZeroQuantity", func(t *testing.T) {
		res := &corev1.ResourceRequirements{}
		err := AddResource(res, "cpu", "0")
		assert.NoError(t, err)
		assert.Equal(t, resource.MustParse("0"), res.Requests["cpu"])
	})

	t.Run("SpecialQuantityFormats", func(t *testing.T) {
		res := &corev1.ResourceRequirements{}
		testCases := []struct {
			quantity string
			valid    bool
		}{
			{"500m", true},
			{"1.5", true},
			{"1Ki", true},
			{"1e3", true},
			{"1.2.3", false},
		}

		for _, tc := range testCases {
			err := AddResource(res, "resource", tc.quantity)
			if tc.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		}
	})
}
