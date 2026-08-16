#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif

#include <windows.h>
#include <wchar.h>

#define PATH_CAPACITY 32768
#define COMMAND_CAPACITY (PATH_CAPACITY * 2 + 8)

static BOOL join_path(
    wchar_t *target,
    size_t target_capacity,
    const wchar_t *directory,
    const wchar_t *filename) {
  const size_t directory_length = wcslen(directory);
  const size_t filename_length = wcslen(filename);

  if (directory_length + filename_length + 2 > target_capacity) {
    return FALSE;
  }

  wmemcpy(target, directory, directory_length);
  target[directory_length] = L'\\';
  wmemcpy(target + directory_length + 1, filename, filename_length);
  target[directory_length + filename_length + 1] = L'\0';
  return TRUE;
}

static BOOL file_exists(const wchar_t *path) {
  const DWORD attributes = GetFileAttributesW(path);
  return attributes != INVALID_FILE_ATTRIBUTES &&
         (attributes & FILE_ATTRIBUTE_DIRECTORY) == 0;
}

static BOOL ensure_directory(const wchar_t *path) {
  if (CreateDirectoryW(path, NULL)) {
    return TRUE;
  }
  return GetLastError() == ERROR_ALREADY_EXISTS;
}

static BOOL build_command_line(
    wchar_t *target,
    size_t target_capacity,
    const wchar_t *node_path,
    const wchar_t *host_path) {
  const size_t node_length = wcslen(node_path);
  const size_t host_length = wcslen(host_path);
  const size_t required = node_length + host_length + 6;

  if (required > target_capacity) {
    return FALSE;
  }

  wchar_t *cursor = target;
  *cursor++ = L'"';
  wmemcpy(cursor, node_path, node_length);
  cursor += node_length;
  *cursor++ = L'"';
  *cursor++ = L' ';
  *cursor++ = L'"';
  wmemcpy(cursor, host_path, host_length);
  cursor += host_length;
  *cursor++ = L'"';
  *cursor = L'\0';
  return TRUE;
}

int WINAPI wWinMain(
    HINSTANCE instance,
    HINSTANCE previous_instance,
    PWSTR command_line,
    int show_command) {
  (void)instance;
  (void)previous_instance;
  (void)command_line;
  (void)show_command;

  wchar_t install_directory[PATH_CAPACITY];
  const DWORD module_length = GetModuleFileNameW(
      NULL,
      install_directory,
      PATH_CAPACITY);
  if (module_length == 0 || module_length >= PATH_CAPACITY) {
    return 10;
  }

  wchar_t *last_separator = wcsrchr(install_directory, L'\\');
  if (last_separator == NULL) {
    return 11;
  }
  *last_separator = L'\0';

  wchar_t node_path[PATH_CAPACITY];
  wchar_t host_path[PATH_CAPACITY];
  wchar_t parser_path[PATH_CAPACITY];
  if (!join_path(node_path, PATH_CAPACITY, install_directory, L"node.exe") ||
      !join_path(host_path, PATH_CAPACITY, install_directory, L"host.js") ||
      !join_path(
          parser_path,
          PATH_CAPACITY,
          install_directory,
          L"parser-server.js")) {
    return 12;
  }

  if (!file_exists(node_path) ||
      !file_exists(host_path) ||
      !file_exists(parser_path)) {
    return 13;
  }

  wchar_t local_app_data[PATH_CAPACITY];
  const DWORD local_app_data_length = GetEnvironmentVariableW(
      L"LOCALAPPDATA",
      local_app_data,
      PATH_CAPACITY);
  if (local_app_data_length == 0 || local_app_data_length >= PATH_CAPACITY) {
    return 14;
  }

  wchar_t app_data_directory[PATH_CAPACITY];
  wchar_t cache_directory[PATH_CAPACITY];
  if (!join_path(
          app_data_directory,
          PATH_CAPACITY,
          local_app_data,
          L"Remanga Plus") ||
      !join_path(
          cache_directory,
          PATH_CAPACITY,
          app_data_directory,
          L"cache")) {
    return 15;
  }

  if (!ensure_directory(app_data_directory) ||
      !ensure_directory(cache_directory)) {
    return 16;
  }

  if (!SetEnvironmentVariableW(L"REMANGA_PARSER_BUNDLE", parser_path) ||
      !SetEnvironmentVariableW(L"REMANGA_NODE_BIN", node_path) ||
      !SetEnvironmentVariableW(
          L"REMANGA_PARSER_CACHE_DIR",
          cache_directory)) {
    return 17;
  }

  wchar_t child_command_line[COMMAND_CAPACITY];
  if (!build_command_line(
          child_command_line,
          COMMAND_CAPACITY,
          node_path,
          host_path)) {
    return 18;
  }

  STARTUPINFOW startup_info;
  PROCESS_INFORMATION process_info;
  ZeroMemory(&startup_info, sizeof(startup_info));
  ZeroMemory(&process_info, sizeof(process_info));
  startup_info.cb = sizeof(startup_info);
  startup_info.dwFlags = STARTF_USESTDHANDLES;
  startup_info.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
  startup_info.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
  startup_info.hStdError = GetStdHandle(STD_ERROR_HANDLE);

  if (!CreateProcessW(
          node_path,
          child_command_line,
          NULL,
          NULL,
          TRUE,
          CREATE_NO_WINDOW,
          NULL,
          install_directory,
          &startup_info,
          &process_info)) {
    return 19;
  }

  CloseHandle(process_info.hThread);
  const DWORD wait_result = WaitForSingleObject(process_info.hProcess, INFINITE);
  if (wait_result != WAIT_OBJECT_0) {
    CloseHandle(process_info.hProcess);
    return 20;
  }

  DWORD exit_code = 1;
  if (!GetExitCodeProcess(process_info.hProcess, &exit_code)) {
    CloseHandle(process_info.hProcess);
    return 21;
  }

  CloseHandle(process_info.hProcess);
  return (int)exit_code;
}
