function vowelsOnly(str) {
  var string2 = "";
  for (var i = 0; i < str.length; i++) {
    if (
      str[i] === "a" ||
      str[i] === "e" ||
      str[i] === "i" ||
      str[i] === "o" ||
      str[i] === "u"
    ) {
      string2 += str[i];
    }
  }
  return string2;
}

console.log(vowelsOnly("kenya"));

function repeatedString(s, n) {
  // Write your code here
  let count = 0;
  const stringL = s.length;
  let newString = "";
  const repeatins = Math.floor(n / stringL);

  count += (s.split("a").length - 1) * repeatins;

  let remainder = n % stringL;
  for (let i = 0; i < remainder; i++) {
    if (s[i] === "a") {
      count++;
      newString = repeatins * s[i];
    }
    console.log(newString);
  }
  return count;
}

console.log(repeatedString("abc", 10));

function rotateString(str, n) {
  const partOne = str.substring(n, str.length);
  const partTwo = str.substring(0, n);

  let outPut = partOne + partTwo;
  return outPut;
}

console.log(rotateString("KenyaYetu", 3));

function findDaysDifferent(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);

  let difference = d1.getTime() - d2.getTime();

  let outPut = Math.floor(difference / (1000 * 3600 * 24));

  return outPut;
}

console.log(findDaysDifferent("2023-04-01", "2023-05-01"));
