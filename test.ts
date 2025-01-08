interface Human {
    name: string;
    age: number;
    sayHello: () => void;
  }
  
  class Person implements Human {
    name: string;
    age: number;
  
    constructor(name: string, age: number) {
      this.name = name;
      this.age = age;
    }
  
    sayHello = () => {
      return "Hello from, " + this.name;
    };
  }
  
  var p1: Person = new Person("John", 30);
  console.log(p1.sayHello());