// Custom ESLint rule to catch missing await on API calls
export default {
    rules: {
        'require-await-on-api-calls': {
            meta: {
                type: 'problem',
                docs: {
                    description: 'Require await keyword when calling API functions',
                    category: 'Possible Errors',
                },
                fixable: 'code',
                schema: [],
            },
            create(context) {
                return {
                    CallExpression(node) {
                        // Check if this is an API call pattern
                        const isApiCall = (
                            // Pattern: someApi.method()
                            node.callee.type === 'MemberExpression' &&
                            node.callee.object.name &&
                            node.callee.object.name.endsWith('Api') &&
                            node.callee.property.type === 'Identifier'
                        ) || (
                                // Pattern: api.get/post/put/delete/patch()
                                node.callee.type === 'MemberExpression' &&
                                node.callee.object.name === 'api' &&
                                ['get', 'post', 'put', 'delete', 'patch'].includes(node.callee.property.name)
                            );

                        if (isApiCall) {
                            // Check if the call is awaited or part of a return statement
                            const parent = node.parent;
                            const isAwaited = parent.type === 'AwaitExpression';
                            const isReturned = parent.type === 'ReturnStatement';
                            const isInThenChain = parent.type === 'MemberExpression' && parent.property.name === 'then';

                            if (!isAwaited && !isReturned && !isInThenChain) {
                                context.report({
                                    node,
                                    message: 'API calls must be awaited or returned. Add "await" keyword or use .then().',
                                    fix(fixer) {
                                        return fixer.insertTextBefore(node, 'await ');
                                    },
                                });
                            }
                        }
                    },
                };
            },
        },
    },
};
