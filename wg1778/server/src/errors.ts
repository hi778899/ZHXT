export class ModelBuilderError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "ModelBuilderError"
    this.status = status
  }
}
