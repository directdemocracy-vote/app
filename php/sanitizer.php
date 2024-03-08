<?php

function error($message) {
  if ($message[0] != '{')
    $message = '"'.$message.'"';
  die("{\"error\":$message}");
}

function sanitize_field($variable, $type, $name) {
  global $mysqli;

  if (!isset($variable))
    return null;

  switch ($type) {
    case 'string':  // FIXME: remove this
      $variable = $variable;
      break;
    case 'year':
      $variable = intval($variable);
      if ($variable > 9999 or $variable < 2023)
        error("$name should be between 2023 and 9999");
      break;
    case '(0|1|2)':
      $variable = intval($variable);
      if ($variable < 0 or $variable > 2)
        error("$name should be between 0 and 2");
      break;
    case 'base64':
      $str = base64_decode($variable, true);
      if ($str === false)
        error("Bad characters in base64 field $name.");
      else {
        $b64 = base64_encode($str);
        if (str_replace('=', '', $variable) !== str_replace('=', '', $b64))
          error("Invalid base64 field $name.");
      }
      break;
    case 'hex':
      if (!ctype_xdigit($variable))
        error("Field $name is not in hexadecimal format.");
      break;
    case 'float':
      $variable = floatval($variable);
      break;
    case 'positive_float':
      $variable = floatval($variable);
      if ($variable < 0)
        error("Field $name should be positive.");
      break;
    case 'positive_int':
      $variable = intval($variable);
      if ($variable < 0)
        error("Field $name should be positive.");
      break;
    case 'url':
      $variable = $mysqli->escape_string($variable);
      $variable = filter_var($variable, FILTER_SANITIZE_URL);
      if (!filter_var($variable, FILTER_VALIDATE_URL))
           error("Field $name is not a valid URL");
      break;
    default:
      error("Unknown type: $type");
  }
  return $variable;
}
?>
