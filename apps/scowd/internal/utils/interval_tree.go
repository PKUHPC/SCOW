package utils

import (
	"bytes"
	"fmt"
	"io"
	"math"
	"os"
	"sync"

	"github.com/sirupsen/logrus"
)

// Interval 表示区间结构
type Interval struct {
	Start, End int64
}

// IntervalNode 区间树节点
type IntervalNode struct {
	Interval Interval
	MaxEnd   int64 // 维护子树最大结束时间
	Left     *IntervalNode
	Right    *IntervalNode
}

// IntervalTree 区间树封装
type IntervalTree struct {
	Root *IntervalNode
	mu   sync.RWMutex // 读写锁保证并发安全
}

// NewIntervalTree 创建空区间树
func NewIntervalTree() *IntervalTree {
	return &IntervalTree{Root: nil}
}

func InitIntervalTree(file *os.File) (*IntervalTree, error) {
	intervalTree := NewIntervalTree()
	// 从元数据文件中恢复区间树
	data, err := io.ReadAll(file)
	if err != nil {
		return intervalTree, fmt.Errorf("failed to read metadata file: %w", err)
	}
	if len(data) > 0 {
		logrus.Infof("hiddenFileMeta data > 0")
		// 解析区间数据并重建区间树
		lines := bytes.Split(data, []byte("\n"))
		for _, line := range lines {
			if len(line) == 0 {
				continue
			}
			var start, end int64
			if _, err := fmt.Sscanf(string(line), "%d %d", &start, &end); err != nil {
				return intervalTree, fmt.Errorf("failed to parse interval data: %w", err)
			}
			intervalTree.Insert(Interval{Start: start, End: end})
		}
	}

	return intervalTree, nil
}

// Insert 插入区间（O(log n)）
func (t *IntervalTree) Insert(interval Interval) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.Root = insert(t.Root, interval)
}

func insert(node *IntervalNode, interval Interval) *IntervalNode {
	if node == nil {
		return &IntervalNode{
			Interval: interval,
			MaxEnd:   interval.End,
		}
	}

	// 按起始点构建二叉搜索树
	if interval.Start < node.Interval.Start {
		node.Left = insert(node.Left, interval)
	} else {
		node.Right = insert(node.Right, interval)
	}

	// 更新子树最大结束时间
	node.MaxEnd = max(interval.End, max(getMaxEnd(node.Left), getMaxEnd(node.Right)))
	return node
}

// FindContaining 查找包含目标点的区间（O(log n)）
func (t *IntervalTree) FindContaining(point int64) *Interval {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.findContaining(point)
}

func (t *IntervalTree) findContaining(point int64) *Interval {
	node := t.findContainingNode(t.Root, point)
	if node != nil {
		return &node.Interval
	}
	return nil
}

func (t *IntervalTree) findContainingNode(node *IntervalNode, point int64) *IntervalNode {
	if node == nil {
		return nil
	}

	// 剪枝优化：子树无可能包含则跳过
	if point > node.MaxEnd {
		return nil
	}

	// 先查左子树（保证最小起始点）
	leftResult := t.findContainingNode(node.Left, point)
	if leftResult != nil {
		return leftResult
	}

	// 检查当前节点
	if node.Interval.Start <= point && point <= node.Interval.End {
		return node
	}

	// 最后查右子树
	return t.findContainingNode(node.Right, point)
}

// MergeIntervals 合并重叠/相邻区间（O(n)）
func (t *IntervalTree) MergeIntervals() []Interval {
	t.mu.Lock()
	defer t.mu.Unlock()

	nodes := t.flatten()
	if len(nodes) == 0 {
		return nil
	}

	// 预分配足够容量，避免频繁扩容
	merged := make([]Interval, 0, len(nodes))
	merged = append(merged, nodes[0].Interval)

	// 快速合并算法
	changed := false
	for i := 1; i < len(nodes); i++ {
		last := &merged[len(merged)-1]
		current := nodes[i].Interval

		// 检查是否可以合并（相邻或重叠）
		if current.Start <= last.End+1 {
			// 只有当合并会扩展区间时才标记为changed
			if current.End > last.End {
				last.End = current.End
				changed = true
			}
		} else {
			merged = append(merged, current)
			changed = true
		}
	}

	// 只有当区间发生变化时才重建树
	if changed {
		// 使用平衡插入算法重建树
		t.Root = nil
		for _, interval := range merged {
			t.Root = insert(t.Root, interval)
		}
	}

	return merged
}

// Flatten 中序遍历获取有序区间（O(n)）
func (t *IntervalTree) Flatten() []*IntervalNode {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.flatten()
}

// 内部方法，不加锁，由调用方保证同步
func (t *IntervalTree) flatten() []*IntervalNode {
	var result []*IntervalNode
	var traverse func(*IntervalNode)
	traverse = func(node *IntervalNode) {
		if node == nil {
			return
		}
		traverse(node.Left)
		result = append(result, node)
		traverse(node.Right)
	}
	traverse(t.Root)
	return result
}

// ExactSearch 精确查询（O(log n)）
func (t *IntervalTree) ExactSearch(target Interval) *Interval {
	t.mu.RLock()
	defer t.mu.RUnlock()
	node := exactSearch(t.Root, target)
	if node != nil {
		return &node.Interval
	}
	return nil
}

// IsComplete 判断区间是否完全覆盖 [0, totalSize)
func (t *IntervalTree) IsComplete(totalSize int64) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()

	nodes := t.flatten()
	if len(nodes) == 0 {
		return false
	}

	intervals := make([]Interval, 0, len(nodes))
	for _, node := range nodes {
		intervals = append(intervals, node.Interval)
	}

	merged := mergeIntervals(intervals)
	if len(merged) == 0 {
		return false
	}

	if merged[0].Start != 0 {
		return false
	}

	currentEnd := merged[0].End
	for i := 1; i < len(merged); i++ {
		if merged[i].Start > currentEnd {
			return false
		}
		if merged[i].End > currentEnd {
			currentEnd = merged[i].End
		}
	}

	return currentEnd >= totalSize
}

// mergeIntervals 合并重叠/相邻区间（输入需已按Start排序）
func mergeIntervals(intervals []Interval) []Interval {
	if len(intervals) == 0 {
		return nil
	}

	merged := []Interval{intervals[0]}
	for i := 1; i < len(intervals); i++ {
		last := &merged[len(merged)-1]
		current := intervals[i]
		if current.Start <= last.End+1 { // 允许相邻合并
			if current.End > last.End {
				last.End = current.End
			}
		} else {
			merged = append(merged, current)
		}
	}
	return merged
}

func exactSearch(node *IntervalNode, target Interval) *IntervalNode {
	if node == nil {
		return nil
	}

	if target.Start == node.Interval.Start && target.End == node.Interval.End {
		return node
	}

	if target.Start < node.Interval.Start {
		return exactSearch(node.Left, target)
	}
	return exactSearch(node.Right, target)
}

// 辅助函数
func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func getMaxEnd(node *IntervalNode) int64 {
	if node == nil {
		return math.MinInt64
	}
	return node.MaxEnd
}
