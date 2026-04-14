let _io = null;

module.exports = {
  set: (io) => {
    _io = io;
  },
  get: () => _io,
  emit: (...args) => _io?.emit(...args),
  to: (...args) => _io?.to(...args),
};
