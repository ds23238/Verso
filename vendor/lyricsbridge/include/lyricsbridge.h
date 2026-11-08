#pragma once
#ifdef __cplusplus
extern "C" {
#endif
/* UTF-8 JSON envelope. Caller owns response; release using matching free. */
char *lb_request(const char *input);
void lb_free(char *response);
#ifdef __cplusplus
}
#endif
