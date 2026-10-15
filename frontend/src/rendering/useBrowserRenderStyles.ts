import { useEffect, useMemo, useState } from 'react'
import { compileBrowserRenderStyles } from './browserThemeStyles'
import {
    compileRenderStyles,
    type CompileRenderStylesInput,
    type CompiledRenderStyles,
} from './themeCssCompiler'

export const useBrowserRenderStyles = (input: CompileRenderStylesInput): CompiledRenderStyles => {
    const initial = useMemo(() => compileRenderStyles(input), [input.theme, input.page, input.version, input.pageCss])
    const [compiled, setCompiled] = useState(initial)

    useEffect(() => {
        let current = true
        setCompiled(initial)
        compileBrowserRenderStyles(input).then(styles => {
            if (current) setCompiled(styles)
        }).catch(() => undefined)
        return () => { current = false }
    }, [initial, input.theme, input.page, input.version, input.pageCss])

    return compiled
}
