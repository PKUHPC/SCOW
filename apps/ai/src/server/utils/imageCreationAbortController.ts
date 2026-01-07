const activeImageCreationControllers = new Map<number, AbortController>();

export function setImageCreationAbortController(imageId: number, controller: AbortController): void {
  // 如果已存在，先清理旧的
  const existing = activeImageCreationControllers.get(imageId);
  if (existing) {
    existing.abort();
  }

  activeImageCreationControllers.set(imageId, controller);
}

export function imageCreationAbortOperation(imageId: number): boolean {
  const controller = activeImageCreationControllers.get(imageId);
  if (controller && !controller.signal.aborted) {
    controller.abort();
    // 中断后立即清理
    activeImageCreationControllers.delete(imageId);
    return true;
  }
  return false;
}

export function removeImageCreationAbortController(imageId: number): void {
  activeImageCreationControllers.delete(imageId);
}

export function isImageCreationAborted(imageId: number): boolean {
  const controller = activeImageCreationControllers.get(imageId);
  return controller?.signal.aborted ?? false;
}

// 清理所有已中断的控制器
export function cleanupImageCreationAbortedControllers(): number {
  let cleanedCount = 0;
  for (const [imageId, controller] of activeImageCreationControllers.entries()) {
    if (controller.signal.aborted) {
      activeImageCreationControllers.delete(imageId);
      cleanedCount++;
    }
  }
  return cleanedCount;
}
