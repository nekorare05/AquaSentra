"""Keep Windows compiler subprocess arguments below the OS command length limit."""
Import('env')
import os
root=env.subst('$PROJECT_DIR')
toolchain=env.PioPlatform().get_package_dir('toolchain-xtensa-esp32')
if os.name=='nt' and toolchain:
    env.Replace(CC=os.path.join(toolchain,'bin','xtensa-esp32-elf-gcc.exe'),
                CXX=os.path.join(toolchain,'bin','xtensa-esp32-elf-g++.exe'),
                AR=os.path.join(toolchain,'bin','xtensa-esp32-elf-ar.exe'),
                RANLIB=os.path.join(toolchain,'bin','xtensa-esp32-elf-ranlib.exe'))
for key in ['CPPPATH','LIBPATH']:
    paths=[]
    for item in env.get(key,[]):
        path=env.subst(str(item))
        try:
            relative=os.path.relpath(path,root)
            paths.append(relative if len(relative)<len(path) else path)
        except ValueError:
            paths.append(path)
    env.Replace(**{key:paths})
    if key=='CPPPATH':
        # SCons RDirs otherwise expands relative paths back into absolute paths.
        env.Replace(_CPPINCFLAGS=' '.join('-I"'+p.replace('\\','/')+'"' for p in paths))
