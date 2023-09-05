/**
 * original source: https://github.com/chalk/supports-color/blob/d4f413efaf8da045c5ab440ed418ef02dbb28bf1/index.js
 *
 * This file was imported due to lacking support of CJS environments in the original package.
 */

import process from 'node:process'
import os from 'node:os'
import tty from 'node:tty'

declare global {
    // eslint-disable-next-line no-var
    var Deno: any
}

// From: https://github.com/sindresorhus/has-flag/blob/main/index.js
/// function hasFlag(flag, argv = globalThis.Deno?.args ?? process.argv) {
function hasFlag(flag: string, argv = globalThis.Deno ? globalThis.Deno.args : process.argv) {
    const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--')
    const position = argv.indexOf(prefix + flag)
    const terminatorPosition = argv.indexOf('--')
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition)
}

interface Options {
    /**
     * By default it is `true`, which instructs `supportsColor()` to sniff `process.argv`
     * for the multitude of `--color` flags (see _Info_ below).
     * If `false`, then `process.argv` is not considered when determining color support.
     * @default true
     */
    sniffFlags?: boolean | undefined;
    isTTY?: boolean | undefined;
}

const { env } = process

let flagForceColor: number | undefined
if (
    hasFlag('no-color')
    || hasFlag('no-colors')
    || hasFlag('color=false')
    || hasFlag('color=never')
) {
    flagForceColor = 0
} else if (
    hasFlag('color')
    || hasFlag('colors')
    || hasFlag('color=true')
    || hasFlag('color=always')
) {
    flagForceColor = 1
}

function envForceColor() {
    if ('FORCE_COLOR' in env) {
        if (env.FORCE_COLOR === 'true') {
            return 1
        }

        if (env.FORCE_COLOR === 'false') {
            return 0
        }

        return env.FORCE_COLOR!.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR!, 10), 3)
    }
}

function translateLevel(level: number) {
    if (level === 0) {
        return false
    }

    return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3,
    }
}

function _supportsColor(haveStream: { isTTY?: boolean }, { streamIsTTY, sniffFlags = true }: { streamIsTTY?: boolean, sniffFlags?: boolean } = {}) {
    const noFlagForceColor = envForceColor()
    if (noFlagForceColor !== undefined) {
        flagForceColor = noFlagForceColor
    }

    const forceColor = sniffFlags ? flagForceColor : noFlagForceColor

    if (forceColor === 0) {
        return 0
    }

    if (sniffFlags) {
        if (hasFlag('color=16m')
            || hasFlag('color=full')
            || hasFlag('color=truecolor')) {
            return 3
        }

        if (hasFlag('color=256')) {
            return 2
        }
    }

    // Check for Azure DevOps pipelines.
    // Has to be above the `!streamIsTTY` check.
    if ('TF_BUILD' in env && 'AGENT_NAME' in env) {
        return 1
    }

    if (haveStream && !streamIsTTY && forceColor === undefined) {
        return 0
    }

    const min = forceColor || 0

    if (env.TERM === 'dumb') {
        return min
    }

    if (process.platform === 'win32') {
        // Windows 10 build 10586 is the first Windows release that supports 256 colors.
        // Windows 10 build 14931 is the first release that supports 16m/TrueColor.
        const osRelease = os.release().split('.')
        if (
            Number(osRelease[0]) >= 10
            && Number(osRelease[2]) >= 10_586
        ) {
            return Number(osRelease[2]) >= 14_931 ? 3 : 2
        }

        return 1
    }

    if ('CI' in env) {
        if ('GITHUB_ACTIONS' in env || 'GITEA_ACTIONS' in env) {
            return 3
        }

        if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'BUILDKITE', 'DRONE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
            return 1
        }

        return min
    }

    if ('TEAMCITY_VERSION' in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION!) ? 1 : 0
    }

    if (env.COLORTERM === 'truecolor') {
        return 3
    }

    if (env.TERM === 'xterm-kitty') {
        return 3
    }

    if ('TERM_PROGRAM' in env) {
        const version = Number.parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10)

        switch (env.TERM_PROGRAM) {
        case 'iTerm.app': {
            return version >= 3 ? 3 : 2
        }

        case 'Apple_Terminal': {
            return 2
        }
        // No default
        }
    }

    if (env.TERM && /-256(color)?$/i.test(env.TERM)) {
        return 2
    }

    if (env.TERM && /^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1
    }

    if ('COLORTERM' in env) {
        return 1
    }

    return min
}

export function createSupportsColor(stream: { isTTY?: boolean }, options: Options = {}) {
    const level = _supportsColor(stream, {
        streamIsTTY: stream && stream.isTTY,
        ...options,
    })

    return translateLevel(level)
}

const supportsColor = {
    stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
    stderr: createSupportsColor({ isTTY: tty.isatty(2) }),
}

export default supportsColor
