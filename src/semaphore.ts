import { getLlmConcurrency } from "./config"

export class Semaphore {
  private permits: number
  private queue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire() {
    if (this.permits > 0) { this.permits--; return }
    await new Promise<void>(resolve => this.queue.push(resolve))
  }

  release() {
    if (this.queue.length > 0) this.queue.shift()!()
    else this.permits++
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire()
    try { return await fn() }
    finally { this.release() }
  }
}

export const llm = new Semaphore(getLlmConcurrency())
