/** 开发期不变式：纯类型助手，编译后无运行时痕迹。 */

/** 断言一个值在类型层面是 never（穷尽检查）。 */
export function assertNever(value: never): never {
  throw new Error(`unexpected value: ${String(value)}`)
}
