
// TODO drop this:
(function () {
    'use strict';

    if (!Array.isArray) {
        Array.isArray = function (vArg) {
            return Object.prototype.toString.call(vArg) === "[object Array]";
        };
    }

    if (!Function.prototype.bind) {
        Function.prototype.bind = function (oThis) {
            if (typeof this !== "function") {
                // closest thing possible to the ECMAScript 5 internal IsCallable function
                throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
            }

            var aArgs = Array.prototype.slice.call(arguments, 1),
                fToBind = this,
                fNOP = function () {
                },
                fBound = function () {
                    return fToBind.apply(this instanceof fNOP && oThis
                                             ? this
                                             : oThis,
                                         aArgs.concat(Array.prototype.slice.call(arguments)));
                };

            fNOP.prototype = this.prototype;
            fBound.prototype = new fNOP();

            return fBound;
        };
    }

    if (!Object.keys) {
        Object.keys = function (o) {
            var result = [];
            var i = 0;
            for (var p in o) {
                if (o.hasOwnProperty(p)) {
                    result[i++] = p;
                }
            }
            return result;
        };
    }

    if (!Object.create) {
        Object.create = function(proto) {
            function F() {}
            F.prototype = proto;
            return new F();
        }
    }

    // http://ejohn.org/blog/objectgetprototypeof/
    if ( typeof Object.getPrototypeOf !== "function" ) {
        if ( typeof "test".__proto__ === "object" ) {
            Object.getPrototypeOf = function(object){
                return object.__proto__;
            };
        } else {
            Object.getPrototypeOf = function(object){
                // May break if the constructor has been tampered with
                return object.constructor.prototype;
            };
        }
    }
})();

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var Kotlin = {};

(function () {

    function toArray(obj) {
        var array;
        if (obj == null) {
            array = [];
        }
        else if(!Array.isArray(obj)) {
            array = [obj];
        }
        else {
            array = obj;
        }
        return array;
    }

    function copyProperties(to, from) {
        if (to == null || from == null) {
            return;
        }
        for (var p in from) {
            if (from.hasOwnProperty(p)) {
                to[p] = from[p];
            }
        }
    }

    function getClass(basesArray) {
        for (var i = 0; i < basesArray.length; i++) {
            if (isNativeClass(basesArray[i]) || basesArray[i].$metadata$.type === Kotlin.TYPE.CLASS) {
                return basesArray[i];
            }
        }
        return null;
    }

    var emptyFunction = function() {
        return function() {};
    };

    Kotlin.TYPE = {
        CLASS: "class",
        TRAIT: "trait",
        OBJECT: "object"
    };

    Kotlin.classCount = 0;
    Kotlin.newClassIndex = function() {
        var tmp = Kotlin.classCount;
        Kotlin.classCount++;
        return tmp;
    };

    function isNativeClass(obj) {
        return !(obj == null) && obj.$metadata$ == null;
    }

    function applyExtension(current, bases, baseGetter) {
        for (var i = 0; i < bases.length; i++) {
            if (isNativeClass(bases[i])) {
                continue;
            }
            var base = baseGetter(bases[i]);
            for (var p in  base) {
                if (base.hasOwnProperty(p)) {
                    if(!current.hasOwnProperty(p) || current[p].$classIndex$ < base[p].$classIndex$) {
                        current[p] = base[p];
                    }
                }
            }
        }
    }

    function computeMetadata(bases, properties) {
        var metadata = {};

        metadata.baseClasses = toArray(bases);
        metadata.baseClass = getClass(metadata.baseClasses);
        metadata.classIndex = Kotlin.newClassIndex();
        metadata.functions = {};
        metadata.properties = {};

        if (!(properties == null)) {
            for (var p in properties) {
                if (properties.hasOwnProperty(p)) {
                    var property = properties[p];
                    property.$classIndex$ = metadata.classIndex;
                    if (typeof property === "function") {
                        metadata.functions[p] = property;
                    } else {
                        metadata.properties[p] = property;
                    }
                }
            }
        }
        applyExtension(metadata.functions, metadata.baseClasses, function (it) {
            return it.$metadata$.functions
        });
        applyExtension(metadata.properties, metadata.baseClasses, function (it) {
            return it.$metadata$.properties
        });

        return metadata;
    }

    function class_object() {
        var object = this.object_initializer$();
        Object.defineProperty(this, "object", {value: object});
        return object;
    }

    Kotlin.createClass = function (bases, constructor, properties, staticProperties) {
        if (constructor == null) {
            constructor = emptyFunction();
        }
        copyProperties(constructor, staticProperties);

        var metadata = computeMetadata(bases, properties);
        metadata.type = Kotlin.TYPE.CLASS;

        var prototypeObj;
        if (metadata.baseClass !== null) {
            prototypeObj = Object.create(metadata.baseClass.prototype);
        } else {
            prototypeObj = {};
        }
        Object.defineProperties(prototypeObj, metadata.properties);
        copyProperties(prototypeObj, metadata.functions);
        prototypeObj.constructor = constructor;

        if (metadata.baseClass != null) {
            constructor.baseInitializer = metadata.baseClass;
        }

        constructor.$metadata$ = metadata;
        constructor.prototype = prototypeObj;
        Object.defineProperty(constructor, "object", {get: class_object, configurable: true});
        return constructor;
    };

    Kotlin.createObject = function (bases, constructor, functions) {
        var noNameClass = Kotlin.createClass(bases, constructor, functions);
        var obj = new noNameClass();
        obj.$metadata$ = {
            type: Kotlin.TYPE.OBJECT
        };
        return  obj;
    };

    Kotlin.createTrait = function (bases, properties, staticProperties) {
        var obj = function () {};
        copyProperties(obj, staticProperties);

        obj.$metadata$ = computeMetadata(bases, properties);
        obj.$metadata$.type = Kotlin.TYPE.TRAIT;
        return obj;
    };

    function isInheritanceFromTrait (objConstructor, trait) {
        if (isNativeClass(objConstructor) || objConstructor.$metadata$.classIndex < trait.$metadata$.classIndex) {
            return false;
        }
        var baseClasses = objConstructor.$metadata$.baseClasses;
        var i;
        for (i = 0; i < baseClasses.length; i++) {
            if (baseClasses[i] === trait) {
                return true;
            }
        }
        for (i = 0; i < baseClasses.length; i++) {
            if (isInheritanceFromTrait(baseClasses[i], trait)) {
                return true;
            }
        }
        return false;
    }

    Kotlin.isType = function (object, klass) {
        if (object == null || klass == null) {
            return false;
        } else {
            if (object instanceof klass) {
                return true;
            }
            else if (isNativeClass(klass) || klass.$metadata$.type == Kotlin.TYPE.CLASS) {
                return false;
            }
            else {
                return isInheritanceFromTrait(object.constructor, klass);
            }
        }
    };


////////////////////////////////// packages & modules //////////////////////////////

    function createPackageGetter(instance, initializer) {
        return function () {
            if (initializer !== null) {
                var tmp = initializer;
                initializer = null;
                tmp.call(instance);
            }

            return instance;
        };
    }

    function createDefinition(members) {
        var definition = {};
        if (members == null) {
            return definition;
        }
        for (var p in members) {
            if (members.hasOwnProperty(p)) {
                if ((typeof members[p]) === "function") {
                    definition[p] = members[p];
                } else {
                    Object.defineProperty(definition, p, members[p]);
                }
            }
        }
        return definition;
    }

    Kotlin.definePackage = function (initializer, members) {
        var definition = createDefinition(members);
        if (initializer === null) {
            return {value: definition};
        }
        else {
            var getter = createPackageGetter(definition, initializer);
            return {get: getter};
        }
    };

    Kotlin.defineRootPackage = function (initializer, members) {
        var definition = createDefinition(members);

        if (initializer === null) {
            definition.$initializer$ = emptyFunction();
        } else {
            definition.$initializer$ = initializer;
        }
        return definition;
      };

    Kotlin.defineModule = function (id, declaration) {
        if (id in Kotlin.modules) {
            throw new Error("Module " + id + " is already defined");
        }
        declaration.$initializer$.call(declaration); // TODO: temporary hack
        Object.defineProperty(Kotlin.modules, id, {value: declaration});
    };

})();


