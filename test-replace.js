let finalQuery = 'VALUES ($1, $2, $10)';
const params = ['cost is $10', 'word with $2', '', '', '', '', '', '', '', 'something'];

for (let i = params.length - 1; i >= 0; i--) {
  let value = "'" + params[i] + "'";
  // Escape $ for the replacement string
  value = value.replace(/\$/g, '$$$$');
  finalQuery = finalQuery.replace(new RegExp('\\$' + (i + 1) + '\\b', 'g'), value);
}
console.log(finalQuery);
