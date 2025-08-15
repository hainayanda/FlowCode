export class Result<T, E> {
  readonly isSuccess: boolean;
  readonly value: T;
  readonly error: E;

  static success<T, E>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined as any);
  }

  static failure<T, E>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined as any, error);
  }

  private constructor(isSuccess: boolean, value: T, error: E) {
    this.isSuccess = isSuccess;
    this.value = value;
    this.error = error;
  }
}