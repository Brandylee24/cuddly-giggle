export const formatterXAxis = (
  locale: string,
  windowPreference: string,
  value: string
) => {

  if(value.length === 0){
    return null;
  }

  const date = new Date(value);
  switch (windowPreference) {
    case '2h':
      return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
    case '24h':
      return date.toLocaleTimeString(locale, { weekday: 'short', hour: 'numeric', minute: 'numeric' });
    case '1w':
    case '1m':
    case '3m':
    case '6m':
    case '1y':
      return date.toLocaleTimeString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    case '2y':
    case '3y':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }
};

export const formatterXAxisLabel = (
  locale: string,
  windowPreference: string,
) => {
  const date = new Date();
  switch (windowPreference) {
    case '2h':
    case '24h':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    case '1w':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
    case '1m':
    case '3m':
    case '6m':
      return date.toLocaleDateString(locale, { year: 'numeric' });
    case '1y':
    case '2y':
    case '3y':
      return null;
  }
};
