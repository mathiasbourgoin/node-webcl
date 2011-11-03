/*
** This file contains proprietary software owned by Motorola Mobility, Inc. **
** No rights, expressed or implied, whatsoever to this software are provided by Motorola Mobility, Inc. hereunder. **
** 
** (c) Copyright 2011 Motorola Mobility, Inc.  All Rights Reserved.  **
*/

var WebCL=require("../lib/webcl"),
sys=require('util'),
clu=require('../lib/clUtils.js');

var log=console.log;

//First check if the WebCL extension is installed at all 
if (WebCL == undefined) {
  alert("Unfortunately your system does not support WebCL. " +
  "Make sure that you have the WebCL extension installed.");
  return;
}

VectorAdd();

function VectorAdd() {
  BUFFER_SIZE=10;
  var A=new Uint32Array(BUFFER_SIZE);
  var B=new Uint32Array(BUFFER_SIZE);
  var C=new Uint32Array(BUFFER_SIZE);

  for (var i = 0; i < BUFFER_SIZE; i++) {
    A[i] = i;
    B[i] = i * 2;
    C[i] = 0;
  }

  //Pick platform
  var platformList=WebCL.getPlatforms();
  platform=platformList[0];

  //Pick first platform
  context=WebCL.createContext(WebCL.CL_DEVICE_TYPE_GPU, [WebCL.CL_CONTEXT_PLATFORM, platform]);

  //Query the set of devices attached to the context
  devices = context.getInfo(WebCL.CL_CONTEXT_DEVICES);

  kernelSourceCode = [
"__kernel void vadd(__global int * a, __global int * b, __global int * c, int iNumElements) ",
"{                                                                           ",
"    size_t i =  get_global_id(0);                                           ",
"    if(i > iNumElements) return;                                            ",
"    c[i] = a[i] + b[i];                                                     ",
"}                                                                           "
].join("\n");

  //Create and program from source
  program=context.createProgram(kernelSourceCode);

  //Build program
  program.build(devices,"");

  size=BUFFER_SIZE*Uint32Array.BYTES_PER_ELEMENT; // size in bytes
  
  //Create kernel object
  try {
    kernel= program.createKernel("vadd");
  }
  catch(err) {
    console.log(program.getBuildInfo(devices[0],WebCL.CL_PROGRAM_BUILD_LOG));
  }
  
  //Create command queue
  queue=context.createCommandQueue(devices[0], 0);

  //Create buffer for A and copy host contents
  //aBuffer = context.createBuffer(WebCL.CL_MEM_READ_ONLY, size);
  aBuffer = context.createBuffer(WebCL.CL_MEM_READ_WRITE, size);
  map=queue.enqueueMapBuffer(aBuffer, WebCL.CL_TRUE, WebCL.CL_MAP_WRITE, 0, BUFFER_SIZE * Uint32Array.BYTES_PER_ELEMENT);
  var buf=new DataView(map.getBuffer());
  for(var i=0;i<BUFFER_SIZE;i++) {
    buf.setUint32(i,A[i]);
  }
  queue.enqueueUnmapMemObject(aBuffer, map);

  //Create buffer for B and copy host contents
  //bBuffer = context.createBuffer(WebCL.CL_MEM_READ_ONLY, size);
  bBuffer = context.createBuffer(WebCL.CL_MEM_READ_WRITE, size);
  map=queue.enqueueMapBuffer(bBuffer, WebCL.CL_TRUE, WebCL.CL_MAP_WRITE, 0, BUFFER_SIZE * Uint32Array.BYTES_PER_ELEMENT);
  for(var i=0;i<BUFFER_SIZE;i++) {
    map.getBuffer()[i]=B[i];
  }
  queue.enqueueUnmapMemObject(bBuffer, map);

  //Create buffer for that uses the host ptr C
  cBuffer = context.createBuffer(WebCL.CL_MEM_READ_WRITE, size);

  //Set kernel args
  kernel.setArg(0, aBuffer, WebCL.type.MEM);
  kernel.setArg(1, bBuffer, WebCL.type.MEM);
  kernel.setArg(2, cBuffer, WebCL.type.MEM);
  kernel.setArg(3, BUFFER_SIZE, WebCL.type.INT | WebCL.type.UNSIGNED);

  // Init ND-range
  var localWS = [5];
  var globalWS = [Math.ceil (BUFFER_SIZE / localWS) * localWS];

  log("Global work item size: " + globalWS);
  log("Local work item size: " + localWS);

  // Execute (enqueue) kernel
  log("using enqueueNDRangeKernel");
  queue.enqueueNDRangeKernel(kernel,
      [],
      [globalWS],
      [localWS]);
  
  //printResults(A,B,C);
  //There is no need to perform a finish on the final unmap
  //or release any objects as this all happens implicitly with
  //the C++ Wrapper API.
  
  log("using enqueueMapBuffer");
  // Map cBuffer to host pointer. This enforces a sync with 
  // the host backing space, remember we choose GPU device.
  map=queue.enqueueMapBuffer(
      cBuffer,
      WebCL.CL_TRUE, // block 
      WebCL.CL_MAP_READ,
      0,
      BUFFER_SIZE * Uint32Array.BYTES_PER_ELEMENT);
  
  for(var i=0;i<BUFFER_SIZE;i++) {
    C[i]=map.getBuffer()[i];
  }

  queue.enqueueUnmapMemObject(cBuffer, map);
  
  queue.finish (); //Finish all the operations

  printResults(A,B,C);
}

function printResults(A,B,C) {
  //Print input vectors and result vector
  var output = "\nA = "; 
  for (var i = 0; i < BUFFER_SIZE; i++) {
    output += A[i] + ", ";
  }
  output += "\nB = ";
  for (var i = 0; i < BUFFER_SIZE; i++) {
    output += B[i] + ", ";
  }
  output += "\nC = ";
  for (var i = 0; i < BUFFER_SIZE; i++) {
    output += C[i] + ", ";
  }

  log(output);
}
function printDeviceInfo(device) {
  log("  Device ID: \t\t\t0x"+device.getID().toString(16));
  log("  CL_DEVICE_NAME: \t\t\t"+device.getInfo(webcl.CL_DEVICE_NAME));
  log("  CL_DEVICE_VENDOR: \t\t\t"+device.getInfo(webcl.CL_DEVICE_VENDOR));
  log("  CL_DRIVER_VERSION: \t\t\t"+device.getInfo(webcl.CL_DRIVER_VERSION));
  log("  CL_DEVICE_VERSION: \t\t\t"+device.getInfo(webcl.CL_DEVICE_VERSION));
  log("  CL_DEVICE_PROFILE: \t\t\t"+device.getInfo(webcl.CL_DEVICE_PROFILE));
  log("  CL_DEVICE_PLATFORM: \t\t\t0x"+device.getInfo(webcl.CL_DEVICE_PLATFORM).toString(16));
  log("  CL_DEVICE_OPENCL_C_VERSION: \t\t"+device.getInfo(webcl.CL_DEVICE_OPENCL_C_VERSION));
  var type=parseInt(device.getInfo(webcl.CL_DEVICE_TYPE));
  if( type & webcl.CL_DEVICE_TYPE_CPU )
    log("  CL_DEVICE_TYPE:\t\t\tCL_DEVICE_TYPE_CPU");
  if( type & webcl.CL_DEVICE_TYPE_GPU )
    log("  CL_DEVICE_TYPE:\t\t\tCL_DEVICE_TYPE_GPU");
  if( type & webcl.CL_DEVICE_TYPE_ACCELERATOR )
    log("  CL_DEVICE_TYPE:\t\t\tCL_DEVICE_TYPE_ACCELERATOR");
  if( type & webcl.CL_DEVICE_TYPE_DEFAULT )
    log("  CL_DEVICE_TYPE:\t\t\tCL_DEVICE_TYPE_DEFAULT");
}