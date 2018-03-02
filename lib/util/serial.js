const relateContext = require('./relate-context');

const pipe = exports.pipe = (...fns) => ({
  freeze(arg, module, extra, methods) {
    for (const fn of fns) {
      arg = fn.freeze(arg, module, extra, methods);
    }
    return arg;
  },
  thaw(arg, frozen, extra, methods) {
    for (const fn of fns) {
      arg = fn.thaw(arg, frozen, extra, methods);
    }
    return arg;
  },
});

const contextual = exports.contextual = (fnname) => {
  const relate = relateContext[`relateNormal${fnname}`];
  const context = relateContext[`contextNormal${fnname}`];
  return {
    freeze: (arg, module, extra, methods) => arg ?
      relate(extra.compilation.compiler, arg) :
      arg,
    thaw: (arg, module, extra, methods) => arg ?
      context(extra.compilation.compiler, arg) :
      arg,
  };
};

const archetype = exports.archetype = (type) => ({
  freeze: (arg, module, extra, {freeze}) => freeze(type, null, arg, extra),
  thaw: (arg, module, extra, {thaw}) => thaw(type, null, arg, extra),
});
const mapArchetype = exports.mapArchetype = (type) => ({
  freeze: (arg, module, extra, {mapFreeze}) => mapFreeze(type, null, arg, extra),
  thaw: (arg, module, extra, {mapThaw}) => mapThaw(type, null, arg, extra),
});

const path = exports.path = contextual('Path');
const pathArray = exports.pathArray = contextual('PathArray');
const pathSet = exports.pathSet = contextual('PathSet');
const request = exports.request = contextual('Request');
const _loaders = exports._loaders = contextual('Loaders');
const loaders = exports.loaders = ({
  freeze: _loaders.freeze,
  thaw(arg, frozen, extra, methods) {
    return _loaders.thaw(arg, frozen, extra, methods)
    .map(loader => {
      if (loader.ident) {
        return {
          loader: loader.loader,
          ident: loader.ident,
          options: extra.normalModuleFactory.ruleSet.findOptionsByIdent(loader.ident),
        };
      }
      return loader;
    });
  },
})
const regExp = exports.regExp = ({
  freeze: arg => arg ? arg.source : false,
  thaw: arg => arg ? new RegExp(arg) : false,
});

const parser = exports.parser = archetype('Parser');
const generator = exports.generator = archetype('Generator');
const source = exports.source = archetype('Source');
const moduleAssets = exports.moduleAssets = archetype('ModuleAssets');
const moduleError = exports.moduleError = mapArchetype('ModuleError');
const moduleWarning = exports.moduleWarning = mapArchetype('ModuleWarning');
const dependencyBlock = exports.dependencyBlock = ({
  freeze: (arg, module, extra, {freeze}) => freeze('DependencyBlock', null, arg, extra),
  thaw: (arg, module, extra, {thaw}) => thaw('DependencyBlock', arg, module, extra),
});

const _null = exports.null = {
  freeze: () => null,
  thaw: () => null,
};
const identity = exports.identity = {
  freeze: (arg, module, extra, methods) => arg,
  thaw: (arg, module, extra, methods) => arg,
};

const assigned = exports.assigned = (members) => ({
  freeze: (new Function(...Object.keys(members), `
    return function(arg, module, extra, methods) {
      return {
        ${Object.keys(members).map(member => (
          `${member}: ${member}(arg.${member}, module, extra, methods),`
        )).join('\n')}
      };
    };
  `))(...Object.values(members).map(member => member.freeze)),
  thaw: (new Function(...Object.keys(members), `
    return function(arg, frozen, extra, methods) {
      ${
        Object.keys(members).map(member => (
          `if (frozen.${member}) arg.${member} = ${member}(frozen.${member}, frozen, extra, methods);\n`
        )).join('')
      }
      return arg;
    };
  `))(...Object.values(members).map(member => member.thaw)),
  // freeze(arg, module, extra, methods) {
  //   const out = {};
  //   for (const key in members) {
  //     out[key] = members[key].freeze(arg[key], module, extra, methods);
  //   }
  //   return out;
  // },
  // thaw(arg, frozen, extra, methods) {
  //   for (const key in members) {
  //     arg[key] = members[key].thaw(frozen[key], frozen, extra, methods);
  //   }
  //   return arg;
  // },
});

const created = exports.created = (members) => ({
  freeze: (new Function(...Object.keys(members), `
    return function(arg, module, extra, methods) {
      if (!arg) {return null;}
      return {
        ${Object.keys(members).map(member => (
          `${member}: ${member}(arg.${member}, module, extra, methods),`
        )).join('\n')}
      };
    };
  `))(...Object.values(members).map(member => member.freeze)),
  thaw: (new Function(...Object.keys(members), `
    return function(arg, frozen, extra, methods) {
      if (!arg) {return null;}
      return {${
        Object.keys(members).map(member => (
          `${member}: ${member}(arg.${member}, frozen, extra, methods),\n`
        )).join('')
      }};
    };
  `))(...Object.values(members).map(member => member.thaw)),
  // freeze(arg, module, extra, methods) {
  //   if (!arg) {
  //     return null;
  //   }
  //   const out = {};
  //   for (const key in members) {
  //     out[key] = members[key].freeze(arg[key], module, extra, methods);
  //   }
  //   return out;
  // },
  // thaw(arg, frozen, extra, methods) {
  //   if (!arg) {
  //     return null;
  //   }
  //   const out = {};
  //   for (const key in members) {
  //     out[key] = members[key].thaw(arg[key], frozen, extra, methods);
  //   }
  //   return out;
  // },
});

const constructed = exports.constructed = (Type, args) => ({
  freeze: (new Function(...Object.keys(args), `
    return function(arg, module, extra, methods) {
      return {
        ${Object.keys(args).map(arg => (
          `${arg}: ${arg}(arg.${arg}, module, extra, methods),`
        )).join('\n')}
      };
    };
  `))(...Object.values(args).map(arg => arg.freeze)),
  thaw: (new Function('Type', ...Object.keys(args), `
    return function(arg, frozen, extra, methods) {
      return new Type(${
        Object.keys(args).map(arg => (
          `${arg}(frozen.${arg}, frozen, extra, methods)`
        )).join(', ')
      });
    };
  `))(Type, ...Object.values(args).map(arg => arg.thaw)),
  // freeze(arg, module, extra, methods) {
  //   const out = {};
  //   for (const key in args) {
  //     out[key] = args[key].freeze(arg[key], module, extra, methods);
  //   }
  //   return out;
  // },
  // thaw(arg, frozen, extra, methods) {
  //   const newArgs = [];
  //   for (const key in args) {
  //     newArgs.push(args[key].thaw(frozen[key], frozen, extra, methods));
  //   }
  //   return new Type(...newArgs);
  // },
});

const serial = exports.serial = (name, stages) => ({
  freeze: (new Function(...Object.keys(stages), `
    return function(arg, module, extra, methods) {
      return {
        type: ${JSON.stringify(name)},
        ${Object.keys(stages).map(stage => (
          `${stage}: ${stage}(module, module, extra, methods),`
        )).join('\n')}
      };
    };
  `))(...Object.values(stages).map(stage => stage.freeze)),
  thaw: (new Function(...Object.keys(stages), `
    return function(arg, frozen, extra, methods) {
      return ${
        Object.keys(stages).length === 0 ?
          'null' :
        Object.keys(stages).slice(1).reverse().map(stage => (
          `${stage}(`
        )).join('') +
        `${Object.keys(stages)[0]}(null, frozen.${Object.keys(stages)[0]}, extra, methods)` +
        Object.keys(stages).slice(1).map(stage => (
          `, frozen.${stage}, extra, methods)`
        )).join('')
      };
    };
  `))(...Object.values(stages).map(stage => stage.thaw)),
  // freeze(arg, module, extra, methods) {
  //   const out = {
  //     type: name,
  //   };
  //   for (const key in stages) {
  //     out[key] = stages[key].freeze(module, module, extra, methods);
  //   }
  //   return out;
  // },
  // thaw(arg, frozen, extra, methods) {
  //   let out;
  //   for (const key in stages) {
  //     out = stages[key].thaw(out, frozen[key], extra, methods);
  //   }
  //   return out;
  // },
});