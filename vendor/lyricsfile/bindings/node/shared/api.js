function checkNumber(_key, value) {
  if (typeof value === 'number' && (!Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    throw new RangeError('Number cannot be represented safely by JavaScript');
  }
  return value;
}
export function createApi(getRequest) {
  function request(payload) {
    const nativeRequest = getRequest();
    const result = JSON.parse(nativeRequest(JSON.stringify(payload, checkNumber)), checkNumber);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }
  return {
    parse: source => request({op: 'parse', source}),
    stringify: document => request({op: 'stringify', document}),
    validate: document => request({op: 'validate', document}),
  };
}
