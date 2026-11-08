/** Keep one running revision and only the latest waiting revision. */
export class LatestQueue<T extends { id: number }> {
  private busy = false;
  private next: T | undefined;
  constructor(private send: (request: T) => void) {}
  submit(request: T) {
    if (this.busy) this.next = request;
    else {
      this.busy = true;
      this.send(request);
    }
  }
  complete() {
    this.busy = false;
    const next = this.next;
    this.next = undefined;
    if (next) this.submit(next);
  }
}
