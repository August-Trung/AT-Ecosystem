import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';

type ValidationError = {
  path: string;
  message: string;
};

const getType = (value: any) => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
};

const typeMatches = (schemaType: any, value: any) => {
  if (!schemaType) return true;
  const actual = getType(value);
  if (Array.isArray(schemaType)) return schemaType.includes(actual);
  return schemaType === actual;
};

const validate = (schema: any, data: any, path = '$'): ValidationError[] => {
  const errors: ValidationError[] = [];
  if (!typeMatches(schema.type, data)) {
    errors.push({ path, message: `Expected ${schema.type}, got ${getType(data)}` });
    return errors;
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push({ path, message: `Value not in enum` });
  }

  if (schema.type === 'string' && typeof data === 'string') {
    if (schema.minLength && data.length < schema.minLength) {
      errors.push({ path, message: `Min length ${schema.minLength}` });
    }
    if (schema.maxLength && data.length > schema.maxLength) {
      errors.push({ path, message: `Max length ${schema.maxLength}` });
    }
    if (schema.pattern) {
      try {
        const reg = new RegExp(schema.pattern);
        if (!reg.test(data)) errors.push({ path, message: `Pattern ${schema.pattern} not matched` });
      } catch {
        errors.push({ path, message: `Invalid pattern ${schema.pattern}` });
      }
    }
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, message: `Minimum ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, message: `Maximum ${schema.maximum}` });
    }
  }

  if (schema.type === 'object' && data && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) {
      schema.required.forEach((key: string) => {
        if (!(key in data)) {
          errors.push({ path: `${path}.${key}`, message: 'Required property missing' });
        }
      });
    }
    if (schema.properties) {
      Object.keys(schema.properties).forEach((key) => {
        if (key in data) {
          errors.push(...validate(schema.properties[key], data[key], `${path}.${key}`));
        }
      });
    }
  }

  if (schema.type === 'array' && Array.isArray(data) && schema.items) {
    data.forEach((item, index) => {
      errors.push(...validate(schema.items, item, `${path}[${index}]`));
    });
  }

  return errors;
};

const JsonSchemaValidator = () => {
  const [schemaInput, setSchemaInput] = useState('{\n  "type": "object",\n  "required": ["id", "name"],\n  "properties": {\n    "id": { "type": "number" },\n    "name": { "type": "string", "minLength": 2 }\n  }\n}');
  const [dataInput, setDataInput] = useState('{\n  "id": 1,\n  "name": "AT Tools"\n}');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  const validateInput = () => {
    try {
      const schema = JSON.parse(schemaInput);
      const data = JSON.parse(dataInput);
      const result = validate(schema, data);
      setErrors(result);
      setStatus(result.length === 0 ? 'ok' : 'fail');
    } catch (e: any) {
      setErrors([{ path: '$', message: e.message }]);
      setStatus('fail');
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <ShieldCheck className="text-emerald-400" /> JSON Schema Validator
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className="text-sm font-bold text-gray-500">Schema</label>
          <textarea
            value={schemaInput}
            onChange={(e) => setSchemaInput(e.target.value)}
            className="w-full h-64 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
        </div>
        <div>
          <label className="text-sm font-bold text-gray-500">Data</label>
          <textarea
            value={dataInput}
            onChange={(e) => setDataInput(e.target.value)}
            className="w-full h-64 mt-2 bg-dark-900 border border-dark-700 rounded-lg p-3 font-mono text-xs text-gray-200"
            spellCheck={false}
          />
        </div>
      </div>

      <button
        onClick={validateInput}
        className="mt-4 w-full bg-emerald-500 text-black font-bold rounded-lg py-2 hover:bg-emerald-400"
      >
        Validate
      </button>

      {status !== 'idle' && (
        <div className={`mt-4 border rounded-lg p-3 text-sm ${status === 'ok' ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-300' : 'bg-red-900/20 border-red-500/50 text-red-300'}`}>
          {status === 'ok' ? (
            <div className="flex items-center gap-2"><CheckCircle2 size={16} /> Valid</div>
          ) : (
            <div className="flex items-center gap-2"><AlertTriangle size={16} /> {errors.length} errors</div>
          )}
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-3 space-y-2">
          {errors.map((err, idx) => (
            <div key={`${err.path}-${idx}`} className="bg-dark-800 border border-dark-700 rounded-lg p-3 text-xs text-red-300">
              <span className="text-red-400 font-bold">{err.path}</span> - {err.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default JsonSchemaValidator;
