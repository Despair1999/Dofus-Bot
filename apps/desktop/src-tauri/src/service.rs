//! Own only our bundled service: reclaim its old listener on upgrade and bind
//! the new child to a kill-on-close job so updater process exits cannot orphan it.
#[cfg(windows)]
mod platform {
    use sha2::{Digest, Sha256};
    use std::{io, mem::size_of, os::windows::io::AsRawHandle, path::Path, process::Child};
    use windows_sys::Win32::{
        Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0},
        NetworkManagement::IpHelper::{
            GetExtendedTcpTable, MIB_TCPTABLE_OWNER_PID, TCP_TABLE_OWNER_PID_LISTENER,
        },
        Networking::WinSock::AF_INET,
        System::{
            JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
                SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
            },
            Threading::{
                OpenProcess, QueryFullProcessImageNameW, TerminateProcess, WaitForSingleObject,
                PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
            },
        },
    };

    pub struct ServiceJob(usize);
    impl Drop for ServiceJob {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0 as HANDLE);
            }
        }
    }
    impl ServiceJob {
        pub fn attach(child: &Child) -> io::Result<Self> {
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() {
                    return Err(io::Error::last_os_error());
                }
                let job = Self(handle as usize);
                let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                if SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &limits as *const _ as _,
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                ) == 0
                    || AssignProcessToJobObject(handle, child.as_raw_handle() as HANDLE) == 0
                {
                    return Err(io::Error::last_os_error());
                }
                Ok(job)
            }
        }
    }
    fn comparable(path: &Path) -> io::Result<String> {
        Ok(path
            .canonicalize()?
            .to_string_lossy()
            .trim_start_matches("\\\\?\\")
            .to_lowercase())
    }
    // v0.1 portable updates may move into an installed directory. Accept that
    // one legacy bundle only by its reviewed backend hash and exact bundle shape.
    fn is_known_legacy_service(executable: &Path) -> bool {
        let Some(folder) = executable.parent() else {
            return false;
        };
        if !executable
            .file_name()
            .is_some_and(|name| name.as_encoded_bytes().eq_ignore_ascii_case(b"node.exe"))
            || !folder
                .file_name()
                .is_some_and(|name| name.as_encoded_bytes().eq_ignore_ascii_case(b"service"))
            || !folder
                .parent()
                .is_some_and(|parent| parent.join("dofus-companion.exe").is_file())
        {
            return false;
        }
        let backend = folder.join("backend.mjs");
        if !backend.metadata().is_ok_and(|m| m.len() < 5_000_000) {
            return false;
        }
        let Ok(bytes) = std::fs::read(backend) else {
            return false;
        };
        format!("{:x}", Sha256::digest(bytes))
            == "02a113d6777abfd20814aaa4ce64faf5d98b9baee3225b5b91760a85d7a529cb"
    }
    pub fn reclaim_previous_service(executable: &Path) -> io::Result<()> {
        reclaim_service(executable, 4310)
    }
    fn reclaim_service(executable: &Path, port: u16) -> io::Result<()> {
        unsafe {
            let mut size = 0u32;
            GetExtendedTcpTable(
                std::ptr::null_mut(),
                &mut size,
                0,
                AF_INET as u32,
                TCP_TABLE_OWNER_PID_LISTENER,
                0,
            );
            let mut buffer = vec![0u64; (size as usize).div_ceil(8)];
            let status = GetExtendedTcpTable(
                buffer.as_mut_ptr() as _,
                &mut size,
                0,
                AF_INET as u32,
                TCP_TABLE_OWNER_PID_LISTENER,
                0,
            );
            if status != 0 {
                return Err(io::Error::from_raw_os_error(status as i32));
            }
            let table = buffer.as_ptr() as *const MIB_TCPTABLE_OWNER_PID;
            let count = (*table).dwNumEntries as usize;
            if size_of::<u32>()
                + count
                    * size_of::<windows_sys::Win32::NetworkManagement::IpHelper::MIB_TCPROW_OWNER_PID>(
                    )
                > buffer.len() * 8
            {
                return Err(io::Error::other("Ungültige TCP-Prozesstabelle"));
            }
            for row in std::slice::from_raw_parts((*table).table.as_ptr(), count) {
                if u16::from_be(row.dwLocalPort as u16) != port {
                    continue;
                }
                let process = OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE | PROCESS_SYNCHRONIZE,
                    0,
                    row.dwOwningPid,
                );
                if process.is_null() {
                    return Err(io::Error::last_os_error());
                }
                let result = (|| {
                    let mut image = vec![0u16; 32768];
                    let mut length = image.len() as u32;
                    if QueryFullProcessImageNameW(process, 0, image.as_mut_ptr(), &mut length) == 0
                    {
                        return Err(io::Error::last_os_error());
                    }
                    let actual = String::from_utf16_lossy(&image[..length as usize]);
                    if comparable(Path::new(&actual))? != comparable(executable)?
                        && !is_known_legacy_service(Path::new(&actual))
                    {
                        return Err(io::Error::other("Port 4310 wird von einem anderen Programm verwendet. Dieses wurde nicht beendet."));
                    }
                    if TerminateProcess(process, 0) == 0
                        || WaitForSingleObject(process, 5000) != WAIT_OBJECT_0
                    {
                        return Err(io::Error::other(
                            "Bisheriger Companion-Dienst konnte nicht beendet werden",
                        ));
                    }
                    Ok(())
                })();
                CloseHandle(process);
                result?;
            }
            Ok(())
        }
    }
    #[cfg(test)]
    mod tests {
        use super::*;
        use std::{
            net::{TcpListener, TcpStream},
            process::Command,
            time::{Duration, Instant},
        };
        #[test]
        #[ignore = "Child fixture, invoked only by the lifecycle test"]
        fn listener_child() {
            let Ok(port) = std::env::var("COMPANION_TEST_LISTENER_PORT") else {
                return;
            };
            let _listener = TcpListener::bind(format!("127.0.0.1:{port}")).unwrap();
            std::thread::sleep(Duration::from_secs(30));
        }
        fn child() -> (Child, u16) {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let port = listener.local_addr().unwrap().port();
            drop(listener);
            let child = Command::new(std::env::current_exe().unwrap())
                .args([
                    "--ignored",
                    "--exact",
                    "service::platform::tests::listener_child",
                ])
                .env("COMPANION_TEST_LISTENER_PORT", port.to_string())
                .stdout(std::process::Stdio::null())
                .spawn()
                .unwrap();
            let start = Instant::now();
            while TcpStream::connect(("127.0.0.1", port)).is_err() {
                assert!(start.elapsed() < Duration::from_secs(5));
                std::thread::sleep(Duration::from_millis(20));
            }
            (child, port)
        }
        #[test]
        fn owned_listener_is_reclaimed_and_unrelated_process_is_never_killed() {
            let (mut child, port) = child();
            assert!(reclaim_service(Path::new("nonexistent-unrelated-node.exe"), port).is_err());
            assert!(child.try_wait().unwrap().is_none());
            reclaim_service(&std::env::current_exe().unwrap(), port).unwrap();
            assert!(child.wait().unwrap().success());
        }
        #[test]
        fn closing_job_also_ends_service_without_shutdown_callback() {
            let (mut child, _) = child();
            let guard = ServiceJob::attach(&child).unwrap();
            drop(guard);
            let start = Instant::now();
            while child.try_wait().unwrap().is_none() {
                assert!(start.elapsed() < Duration::from_secs(5));
                std::thread::sleep(Duration::from_millis(20));
            }
        }
    }
}
#[cfg(windows)]
pub use platform::*;

#[cfg(not(windows))]
pub struct ServiceJob;
#[cfg(not(windows))]
impl ServiceJob {
    pub fn attach(_: &std::process::Child) -> std::io::Result<Self> {
        Ok(Self)
    }
}
#[cfg(not(windows))]
pub fn reclaim_previous_service(_: &std::path::Path) -> std::io::Result<()> {
    Ok(())
}
