#pragma once
#ifdef __cplusplus
extern "C" {
#endif
/* UTF-8 JSON envelope. Caller owns response; release using matching free. */
char *lf_request(const char *input);
void lf_free(char *response);
#ifdef __cplusplus
}
#endif
