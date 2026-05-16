function matchesType(value, type) {
    switch (type) {
        case 'array':
            return Array.isArray(value);
        case 'integer':
            return typeof value === 'number' && Number.isInteger(value);
        case 'number':
            return typeof value === 'number' && Number.isFinite(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        case 'string':
            return typeof value === 'string';
        case 'null':
            return value === null;
        default:
            return true;
    }
}
function typeLabel(type) {
    if (Array.isArray(type))
        return type.join(' or ');
    return type ?? 'valid value';
}
function typeList(type) {
    if (!type)
        return [];
    return Array.isArray(type) ? type : [type];
}
function formatEnum(values) {
    return values.map(value => JSON.stringify(value)).join(', ');
}
function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function valuesEqual(left, right) {
    if (Object.is(left, right))
        return true;
    if (typeof left !== typeof right)
        return false;
    if (left === null || right === null)
        return left === right;
    if (typeof left !== 'object')
        return false;
    try {
        return JSON.stringify(left) === JSON.stringify(right);
    }
    catch {
        return false;
    }
}
function coerceValueForTypes(value, allowedTypes) {
    if (typeof value !== 'string')
        return { value, coerced: false };
    const trimmed = value.trim();
    if (!trimmed)
        return { value, coerced: false };
    if (allowedTypes.includes('integer') || allowedTypes.includes('number')) {
        const numberValue = Number(trimmed);
        if (Number.isFinite(numberValue)
            && (!allowedTypes.includes('integer') || Number.isInteger(numberValue))) {
            return { value: numberValue, coerced: true };
        }
    }
    if (allowedTypes.includes('boolean')) {
        if (/^(?:true|false)$/i.test(trimmed)) {
            return { value: trimmed.toLowerCase() === 'true', coerced: true };
        }
    }
    return { value, coerced: false };
}
function validateNumberBounds(path, value, schema, errors) {
    if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`Argument "${path}" must be at least ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`Argument "${path}" must be at most ${schema.maximum}`);
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
        errors.push(`Argument "${path}" must be greater than ${schema.exclusiveMinimum}`);
    }
    if (typeof schema.exclusiveMaximum === 'number' && value >= schema.exclusiveMaximum) {
        errors.push(`Argument "${path}" must be less than ${schema.exclusiveMaximum}`);
    }
    if (schema.exclusiveMinimum === true && schema.minimum !== undefined && value <= schema.minimum) {
        errors.push(`Argument "${path}" must be greater than ${schema.minimum}`);
    }
    if (schema.exclusiveMaximum === true && schema.maximum !== undefined && value >= schema.maximum) {
        errors.push(`Argument "${path}" must be less than ${schema.maximum}`);
    }
}
function validateStringConstraints(path, value, schema, errors) {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`Argument "${path}" must contain at least ${schema.minLength} character${schema.minLength === 1 ? '' : 's'}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`Argument "${path}" must contain at most ${schema.maxLength} character${schema.maxLength === 1 ? '' : 's'}`);
    }
    if (schema.pattern) {
        try {
            if (!new RegExp(`^(?:${schema.pattern})$`).test(value)) {
                errors.push(`Argument "${path}" must match pattern ${JSON.stringify(schema.pattern)}`);
            }
        }
        catch {
            errors.push(`Schema for "${path}" contains invalid pattern ${JSON.stringify(schema.pattern)}`);
        }
    }
}
function validateCompositeSchema(path, value, schema, context) {
    if (schema.allOf) {
        let nextValue = value;
        for (const childSchema of schema.allOf) {
            const result = validateValueAgainstSchema(path, nextValue, childSchema, context);
            nextValue = result.value;
        }
        return { matched: true, value: nextValue };
    }
    const alternatives = schema.oneOf ?? schema.anyOf;
    if (!alternatives)
        return { matched: true, value };
    const matches = [];
    for (const childSchema of alternatives) {
        const trial = {
            ...context,
            errors: [],
            warnings: [],
        };
        const result = validateValueAgainstSchema(path, value, childSchema, trial);
        if (trial.errors.length === 0)
            matches.push(result.value);
    }
    if (schema.oneOf && matches.length !== 1) {
        context.errors.push(`Argument "${path}" must match exactly one allowed schema`);
        return { matched: false, value };
    }
    if (schema.anyOf && matches.length < 1) {
        context.errors.push(`Argument "${path}" must match at least one allowed schema`);
        return { matched: false, value };
    }
    return { matched: true, value: matches[0] ?? value };
}
function validateObjectAgainstSchema(path, value, schema, context) {
    const properties = schema.properties ?? {};
    const cleaned = {};
    for (const required of schema.required ?? []) {
        const propValue = value[required];
        const isMissing = propValue === undefined
            || propValue === null
            || propValue === ''
            || (Array.isArray(propValue) && propValue.length === 0);
        if (isMissing) {
            context.errors.push(`Missing required argument "${path ? `${path}.` : ''}${required}"`);
        }
    }
    for (const [name, entryValue] of Object.entries(value)) {
        if (entryValue === undefined || entryValue === null) {
            if (name in properties || !context.stripUnknownProperties)
                cleaned[name] = entryValue;
            continue;
        }
        const property = properties[name];
        if (!property) {
            if (schema.additionalProperties === false || context.stripUnknownProperties) {
                context.warnings.push(`Stripped unknown argument "${path ? `${path}.` : ''}${name}"`);
            }
            else if (isRecord(schema.additionalProperties)) {
                cleaned[name] = validateValueAgainstSchema(path ? `${path}.${name}` : name, entryValue, schema.additionalProperties, context).value;
            }
            else {
                cleaned[name] = entryValue;
            }
            continue;
        }
        cleaned[name] = validateValueAgainstSchema(path ? `${path}.${name}` : name, entryValue, property, context).value;
    }
    return cleaned;
}
function validateArrayAgainstSchema(path, value, schema, context) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
        context.errors.push(`Argument "${path}" must contain at least ${schema.minItems} item${schema.minItems === 1 ? '' : 's'}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        context.errors.push(`Argument "${path}" must contain at most ${schema.maxItems} item${schema.maxItems === 1 ? '' : 's'}`);
    }
    if (!schema.items)
        return value;
    if (Array.isArray(schema.items)) {
        const tupleSchemas = schema.items;
        return value.map((item, index) => {
            const itemSchema = tupleSchemas[index];
            return itemSchema
                ? validateValueAgainstSchema(`${path}[${index}]`, item, itemSchema, context).value
                : item;
        });
    }
    return value.map((item, index) => validateValueAgainstSchema(`${path}[${index}]`, item, schema.items, context).value);
}
function validateValueAgainstSchema(path, rawValue, schema, context) {
    const composite = validateCompositeSchema(path, rawValue, schema, context);
    if (!composite.matched)
        return { value: rawValue };
    let value = composite.value;
    const allowedTypes = typeList(schema.type);
    if (context.coercePrimitives
        && allowedTypes.length > 0
        && !allowedTypes.some(type => matchesType(value, type))) {
        const coerced = coerceValueForTypes(value, allowedTypes);
        if (coerced.coerced) {
            context.warnings.push(`Coerced argument "${path}" to ${typeof coerced.value}`);
            value = coerced.value;
        }
    }
    if (allowedTypes.length > 0 && !allowedTypes.some(type => matchesType(value, type))) {
        context.errors.push(`Argument "${path}" must be ${typeLabel(schema.type)}`);
        return { value };
    }
    if (schema.const !== undefined && !valuesEqual(value, schema.const)) {
        context.errors.push(`Argument "${path}" must be ${JSON.stringify(schema.const)}`);
    }
    if (schema.enum
        && !context.skipEnumProperties.has(path)
        && !context.skipEnumProperties.has(path.split('.').at(-1) ?? path)
        && !schema.enum.some(candidate => valuesEqual(candidate, value))) {
        context.errors.push(`Argument "${path}" must be one of ${formatEnum(schema.enum)}`);
    }
    if (typeof value === 'number') {
        validateNumberBounds(path, value, schema, context.errors);
    }
    if (typeof value === 'string') {
        validateStringConstraints(path, value, schema, context.errors);
    }
    if (Array.isArray(value)) {
        value = validateArrayAgainstSchema(path, value, schema, context);
    }
    if (isRecord(value)) {
        value = validateObjectAgainstSchema(path, value, schema, context);
    }
    return { value };
}
export function validateAndNormalizeHostedToolArguments(tools, toolName, args, options = {}) {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
        return {
            ok: false,
            errors: ['Tool arguments must be a JSON object'],
            cleaned: {},
            warnings: [],
        };
    }
    const tool = tools.find(candidate => candidate.function.name === toolName);
    if (!tool) {
        return {
            ok: false,
            errors: [`Unknown hosted Sogni tool "${toolName}"`],
            cleaned: args,
            warnings: [],
        };
    }
    const schema = tool.function.parameters;
    if (!schema) {
        return { ok: true, errors: [], cleaned: args, warnings: [] };
    }
    const context = {
        skipEnumProperties: new Set(options.skipEnumProperties ?? ['model']),
        coercePrimitives: options.coercePrimitives === true,
        stripUnknownProperties: options.stripUnknownProperties === true,
        errors: [],
        warnings: [],
    };
    const normalizedSchema = {
        ...schema,
        type: schema.type ?? 'object',
    };
    const cleaned = validateValueAgainstSchema('', args, normalizedSchema, context).value;
    return {
        ok: context.errors.length === 0,
        errors: context.errors,
        cleaned: isRecord(cleaned) ? cleaned : args,
        warnings: context.warnings,
    };
}
export function validateHostedToolArguments(tools, toolName, args, options = {}) {
    const result = validateAndNormalizeHostedToolArguments(tools, toolName, args, options);
    return {
        ok: result.ok,
        errors: result.errors,
    };
}
export function assertHostedToolArguments(tools, toolName, args, options) {
    const result = validateHostedToolArguments(tools, toolName, args, options);
    if (!result.ok) {
        throw new Error(`Invalid ${toolName} arguments: ${result.errors.join('; ')}`);
    }
}
//# sourceMappingURL=hostedToolValidation.js.map