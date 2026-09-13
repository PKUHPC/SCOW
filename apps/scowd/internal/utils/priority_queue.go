package utils

// PriorityQueue 是一个通用的优先级队列实现
type PriorityQueue[T any] struct {
	items []T
	less  func(i, j T) bool
}

// NewPriorityQueue 创建一个新的优先级队列
func NewPriorityQueue[T any](less func(i, j T) bool) *PriorityQueue[T] {
	return &PriorityQueue[T]{
		items: make([]T, 0),
		less:  less,
	}
}

// Len 返回队列长度
func (pq *PriorityQueue[T]) Len() int { return len(pq.items) }

// Less 比较两个元素的优先级
func (pq *PriorityQueue[T]) Less(i, j int) bool {
	return pq.less(pq.items[i], pq.items[j])
}

// Swap 交换两个元素的位置
func (pq *PriorityQueue[T]) Swap(i, j int) {
	pq.items[i], pq.items[j] = pq.items[j], pq.items[i]
}

// Push 添加新元素到队列
func (pq *PriorityQueue[T]) Push(x T) {
	pq.items = append(pq.items, x)
	for i := len(pq.items) - 1; i > 0; {
		parent := (i - 1) / 2
		if !pq.less(pq.items[i], pq.items[parent]) {
			break
		}
		pq.Swap(i, parent)
		i = parent
	}
}

// Pop 移除并返回队列末尾元素
func (pq *PriorityQueue[T]) Pop() T {
	old := pq.items
	n := len(old)
	item := old[0]
	old[0] = old[n-1]
	pq.items = old[:n-1]
	for i := 0; ; {
		left := i*2 + 1
		if left >= len(pq.items) {
			break
		}
		smallest := left
		right := left + 1
		if right < len(pq.items) && pq.less(pq.items[right], pq.items[left]) {
			smallest = right
		}
		if !pq.less(pq.items[smallest], pq.items[i]) {
			break
		}
		pq.Swap(i, smallest)
		i = smallest
	}
	return item
}

// Items 返回队列中的所有元素
func (pq *PriorityQueue[T]) Items() []T {
	return pq.items
}
