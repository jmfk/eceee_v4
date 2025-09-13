import React from 'react';

const alertVariants = {
    default: 'bg-background text-foreground',
    destructive: 'border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive',
};

export const Alert = ({ children, variant = 'default', className = '', ...props }) => {
    const baseClasses = 'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground';
    const variantClasses = alertVariants[variant] || alertVariants.default;

    return (
        <div
            className={`${baseClasses} ${variantClasses} ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};

export const AlertDescription = ({ children, className = '', ...props }) => {
    return (
        <div
            className={`text-sm [&_p]:leading-relaxed ${className}`}
            {...props}
        >
            {children}
        </div>
    );
};
