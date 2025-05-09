# API Error Codes Reference

## Community Controller Errors

### 400 Bad Request
- `MISSING_FIELDS`: Required fields are missing in request
- `INVALID_VOTE_DATA`: Invalid vote structure received

### 403 Forbidden  
- `NOT_AUTHORIZED`: User lacks required permissions

### 404 Not Found
- `COMMUNITY_NOT_FOUND`: Specified community ID doesn't exist
- `USER_NOT_FOUND`: User record not found

### 409 Conflict
- `ALREADY_MEMBER`: User already belongs to community

### 500 Internal Server Error
- `DB_OPERATION_FAILED`: Database operation failed
- `UNEXPECTED_ERROR`: Unexpected server error

## Standard Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": "Additional technical details (optional)"
  }
}